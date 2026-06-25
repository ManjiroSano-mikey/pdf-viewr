import React, { useState, useRef, useEffect } from 'react';
import { db, type Book } from '../db';
import { extractPDFInfo, generatePDFCoverBlob } from '../utils/pdfHelper';
import { XIcon, UploadIcon, ImageIcon, FileTextIcon, InfoIcon } from './Icons';

interface BookUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editBookId?: number | null; // If provided, we are editing this book's cover/details
}

export const BookUploadModal: React.FC<BookUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editBookId = null,
}) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [coverMode, setCoverMode] = useState<'default' | 'custom'>('default');
  
  // Default cover (extracted from PDF)
  const [defaultCoverUrl, setDefaultCoverUrl] = useState<string | null>(null);
  const [defaultCoverBlob, setDefaultCoverBlob] = useState<Blob | null>(null);
  
  // Custom cover (uploaded by user)
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [customCoverBlob, setCustomCoverBlob] = useState<Blob | null>(null);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Load existing book details if we are in Edit Mode
  useEffect(() => {
    if (isOpen && editBookId) {
      const loadBookData = async () => {
        try {
          setIsProcessing(true);
          const book = await db.books.get(editBookId);
          const fileData = await db.bookFiles.get(editBookId);
          if (book && fileData) {
            setTitle(book.title);
            setAuthor(book.author);
            setTotalPages(book.totalPages);
            
            // Extract the current cover from DB
            const coverUrl = URL.createObjectURL(fileData.coverBlob);
            
            if (book.hasCustomCover) {
              setCoverMode('custom');
              setCustomCoverUrl(coverUrl);
              setCustomCoverBlob(fileData.coverBlob);
              
              // Also attempt to recreate default cover from PDF if we can
              try {
                const defaultBlob = await generatePDFCoverBlob(fileData.pdfBlob);
                setDefaultCoverBlob(defaultBlob);
                setDefaultCoverUrl(URL.createObjectURL(defaultBlob));
              } catch (err) {
                console.warn('Could not generate default cover preview', err);
              }
            } else {
              setCoverMode('default');
              setDefaultCoverUrl(coverUrl);
              setDefaultCoverBlob(fileData.coverBlob);
            }
          }
          setIsProcessing(false);
        } catch (err: any) {
          setErrorMsg('Failed to load book details for editing.');
          setIsProcessing(false);
        }
      };
      loadBookData();
    } else if (isOpen) {
      // Reset state for new book
      setPdfFile(null);
      setTitle('');
      setAuthor('');
      setTotalPages(0);
      setCoverMode('default');
      setDefaultCoverUrl(null);
      setDefaultCoverBlob(null);
      setCustomCoverUrl(null);
      setCustomCoverBlob(null);
      setErrorMsg(null);
      setIsSaving(false);
      setIsProcessing(false);
    }
  }, [isOpen, editBookId]);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (defaultCoverUrl) URL.revokeObjectURL(defaultCoverUrl);
      if (customCoverUrl) URL.revokeObjectURL(customCoverUrl);
    };
  }, [defaultCoverUrl, customCoverUrl]);

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setErrorMsg('Please select a valid PDF file.');
      return;
    }

    setErrorMsg(null);
    setPdfFile(file);
    setIsProcessing(true);

    try {
      // 1. Extract Info (title, author, totalPages)
      const info = await extractPDFInfo(file, file.name);
      setTitle(info.title);
      setAuthor(info.author);
      setTotalPages(info.totalPages);

      // 2. Generate PDF Page 1 Cover Preview
      const coverBlob = await generatePDFCoverBlob(file);
      setDefaultCoverBlob(coverBlob);
      const url = URL.createObjectURL(coverBlob);
      setDefaultCoverUrl(url);
      setCoverMode('default');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error processing the PDF file.');
      setPdfFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG/JPEG) for the cover.');
      return;
    }

    setErrorMsg(null);
    const url = URL.createObjectURL(file);
    setCustomCoverUrl(url);
    setCustomCoverBlob(file);
    setCoverMode('custom');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Book title is required.');
      return;
    }

    // In Add mode, PDF file is required
    if (!editBookId && !pdfFile) {
      setErrorMsg('Please select a PDF file first.');
      return;
    }

    const finalCoverBlob = coverMode === 'custom' ? customCoverBlob : defaultCoverBlob;
    if (!finalCoverBlob) {
      setErrorMsg('Failed to determine the book cover. Please select or upload a cover.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      if (editBookId) {
        // --- EDIT MODE ---
        await db.books.update(editBookId, {
          title: title.trim(),
          author: author.trim() || 'Unknown Author',
          hasCustomCover: coverMode === 'custom',
        });

        // Update the cover photo in files table
        const existingFiles = await db.bookFiles.get(editBookId);
        if (existingFiles) {
          await db.bookFiles.put({
            bookId: editBookId,
            pdfBlob: existingFiles.pdfBlob,
            coverBlob: finalCoverBlob,
          });
        }
      } else {
        // --- ADD MODE ---
        const newBook: Book = {
          title: title.trim(),
          author: author.trim() || 'Unknown Author',
          totalPages: totalPages,
          currentPage: 1,
          dateAdded: Date.now(),
          hasCustomCover: coverMode === 'custom',
        };

        // Add to books store
        const bookId = await db.books.add(newBook);

        // Add binary files to bookFiles store
        await db.bookFiles.add({
          bookId: bookId as number,
          pdfBlob: pdfFile!,
          coverBlob: finalCoverBlob,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to save the book to the database.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-sheet animate-slide-up">
        {/* Header */}
        <div className="modal-header">
          <h3>{editBookId ? 'Edit Book Details' : 'Add New PDF Book'}</h3>
          <button className="icon-btn close-btn" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="modal-form">
          {errorMsg && <div className="form-error"><InfoIcon size={16} /> {errorMsg}</div>}

          {/* Step 1: PDF Selection (only in add mode) */}
          {!editBookId && !pdfFile && (
            <div 
              className="upload-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon size={40} className="upload-icon-pulse" />
              <h4>Select PDF File</h4>
              <p>Tap to browse files</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePdfChange}
                accept="application/pdf"
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* Loading Indicator */}
          {isProcessing && (
            <div className="modal-loader">
              <div className="spinner"></div>
              <p>Analyzing PDF file & extracting cover...</p>
            </div>
          )}

          {/* Form details (visible once PDF is processed OR in edit mode) */}
          {!isProcessing && (pdfFile || editBookId) && (
            <div className="form-body">
              {/* File Info pill (only in add mode) */}
              {pdfFile && (
                <div className="file-pill">
                  <FileTextIcon size={16} />
                  <span className="file-pill-name">{pdfFile.name}</span>
                  <span className="file-pill-size">({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}

              {/* Text Fields */}
              <div className="input-group">
                <label>Book Title</label>
                <input
                  type="text"
                  placeholder="Enter book title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="input-group">
                <label>Author</label>
                <input
                  type="text"
                  placeholder="Enter author name"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {/* Cover Photo Customization */}
              <div className="cover-customizer">
                <label>Customize Cover Photo</label>
                
                {/* Options toggle buttons */}
                <div className="cover-tabs">
                  <button
                    type="button"
                    className={`cover-tab-btn ${coverMode === 'default' ? 'active' : ''}`}
                    onClick={() => setCoverMode('default')}
                    disabled={!defaultCoverUrl}
                  >
                    Default Cover
                  </button>
                  <button
                    type="button"
                    className={`cover-tab-btn ${coverMode === 'custom' ? 'active' : ''}`}
                    onClick={() => {
                      setCoverMode('custom');
                      if (!customCoverUrl) {
                        coverInputRef.current?.click();
                      }
                    }}
                  >
                    Custom Image
                  </button>
                </div>

                {/* Previews container */}
                <div className="cover-preview-container">
                  {coverMode === 'default' && defaultCoverUrl && (
                    <div className="cover-preview-wrapper">
                      <img src={defaultCoverUrl} alt="Default cover preview" className="cover-preview-img" />
                      <span className="cover-badge">Auto-extracted</span>
                    </div>
                  )}

                  {coverMode === 'custom' && (
                    <div 
                      className="cover-preview-wrapper custom-upload-zone"
                      onClick={() => coverInputRef.current?.click()}
                    >
                      {customCoverUrl ? (
                        <>
                          <img src={customCoverUrl} alt="Custom cover preview" className="cover-preview-img" />
                          <div className="cover-overlay">
                            <ImageIcon size={20} />
                            <span>Change Image</span>
                          </div>
                        </>
                      ) : (
                        <div className="empty-cover-upload">
                          <ImageIcon size={32} />
                          <span>Tap to upload custom cover</span>
                          <p>Supports PNG, JPEG</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <input
                    type="file"
                    ref={coverInputRef}
                    onChange={handleCustomCoverChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Save Buttons */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="btn-loading">
                      <span className="small-spinner"></span> Saving...
                    </span>
                  ) : editBookId ? (
                    'Save Changes'
                  ) : (
                    'Add to Library'
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
export default BookUploadModal;
