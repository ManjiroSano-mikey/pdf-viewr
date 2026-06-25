import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { db } from '../db';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  ZoomInIcon, 
  ZoomOutIcon, 
  MoonIcon, 
  SunIcon, 
  XIcon 
} from './Icons';

// Ensure worker path is set
const PDFJS_VERSION = '4.2.67';
try {
  const version = pdfjsLib.version || PDFJS_VERSION;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
} catch (e) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
}

interface ReaderProps {
  bookId: number;
  onClose: () => void;
}

export const Reader: React.FC<ReaderProps> = ({ bookId, onClose }) => {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [bookTitle, setBookTitle] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [pageInput, setPageInput] = useState('1');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // 1. Load book PDF blob from DB
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setIsLoading(true);
        // Load metadata
        const book = await db.books.get(bookId);
        if (!book) throw new Error('Book metadata not found');
        setBookTitle(book.title);
        setPageNumber(book.currentPage || 1);
        setPageInput(String(book.currentPage || 1));

        // Load binary PDF file
        const fileData = await db.bookFiles.get(bookId);
        if (!fileData || !fileData.pdfBlob) {
          throw new Error('PDF file binary data not found');
        }

        const arrayBuffer = await fileData.pdfBlob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        
        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setIsLoading(false);
      } catch (err: any) {
        console.error('PDF Load Error:', err);
        setErrorMessage(err.message || 'Could not load PDF document.');
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [bookId]);

  // 2. Render canvas on page changes or zoom adjustments
  useEffect(() => {
    if (!pdf) return;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        setIsPageLoading(true);
        const page = await pdf.getPage(pageNumber);
        
        // Calculate viewport according to zoom factor
        // Base viewport width to be roughly matching container width
        const containerWidth = 370; // Standard mobile inside width
        const baseViewport = page.getViewport({ scale: 1.0 });
        const scale = (containerWidth / baseViewport.width) * zoom;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        setIsPageLoading(false);
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', err);
          setIsPageLoading(false);
        }
      }
    };

    renderPage();

    // Save reading progress back to IndexedDB asynchronously
    db.books.update(bookId, { currentPage: pageNumber });
  }, [pdf, pageNumber, zoom, bookId]);

  // Handle keyboard page jumping
  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPage = parseInt(pageInput, 10);
    if (!isNaN(parsedPage) && parsedPage >= 1 && parsedPage <= totalPages) {
      setPageNumber(parsedPage);
    } else {
      setPageInput(String(pageNumber));
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pageVal = parseInt(e.target.value, 10);
    setPageNumber(pageVal);
    setPageInput(String(pageVal));
  };

  const goToNextPage = () => {
    if (pageNumber < totalPages) {
      const next = pageNumber + 1;
      setPageNumber(next);
      setPageInput(String(next));
    }
  };

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      const prev = pageNumber - 1;
      setPageNumber(prev);
      setPageInput(String(prev));
    }
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z - 0.25, 0.5));
  };

  return (
    <div className={`reader-screen ${darkMode ? 'reader-dark' : 'reader-light'}`}>
      {/* Reader Top Bar */}
      <div className="reader-header">
        <button className="icon-btn back-btn" onClick={onClose}>
          <XIcon size={20} />
        </button>
        <div className="reader-title-container">
          <h4 className="reader-title">{bookTitle}</h4>
          <span className="reader-subtitle">
            Page {pageNumber} of {totalPages}
          </span>
        </div>
        <button 
          className="icon-btn theme-toggle-btn"
          onClick={() => setDarkMode(!darkMode)}
        >
          {darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>
      </div>

      {/* Reader Main Canvas Viewport */}
      <div className="reader-content">
        {isLoading ? (
          <div className="reader-loader">
            <div className="spinner"></div>
            <p>Loading document...</p>
          </div>
        ) : errorMessage ? (
          <div className="reader-error">
            <p>{errorMessage}</p>
            <button className="btn btn-primary" onClick={onClose}>Go Back</button>
          </div>
        ) : (
          <div className="canvas-wrapper">
            <canvas 
              ref={canvasRef} 
              className={`pdf-canvas ${darkMode ? 'inverted-canvas' : ''} ${isPageLoading ? 'rendering-page' : ''}`}
            />
            {isPageLoading && (
              <div className="canvas-mini-loader">
                <div className="mini-spinner"></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reader Bottom Navigation Controls */}
      {!isLoading && !errorMessage && (
        <div className="reader-footer">
          {/* Progress Seek Slider */}
          <div className="progress-slider-container">
            <input
              type="range"
              min="1"
              max={totalPages}
              value={pageNumber}
              onChange={handleSliderChange}
              className="progress-scrub-bar"
            />
          </div>

          <div className="controls-row">
            {/* Page Navigation */}
            <div className="page-nav-btns">
              <button 
                className="icon-btn control-btn"
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
              >
                <ChevronLeftIcon size={24} />
              </button>

              <form onSubmit={handlePageSubmit} className="page-form">
                <input
                  type="text"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => setPageInput(String(pageNumber))}
                  className="page-input"
                />
                <span className="page-total">/ {totalPages}</span>
              </form>

              <button 
                className="icon-btn control-btn"
                onClick={goToNextPage}
                disabled={pageNumber >= totalPages}
              >
                <ChevronRightIcon size={24} />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="zoom-controls">
              <button 
                className="icon-btn control-btn"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
              >
                <ZoomOutIcon size={18} />
              </button>
              <span className="zoom-text">{Math.round(zoom * 100)}%</span>
              <button 
                className="icon-btn control-btn"
                onClick={handleZoomIn}
                disabled={zoom >= 2.5}
              >
                <ZoomInIcon size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Reader;
