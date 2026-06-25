import React, { useState, useEffect } from 'react';
import { db, type Book } from '../db';
import { 
  PlusIcon, 
  SearchIcon, 
  TrashIcon, 
  EditIcon, 
  BookIcon 
} from './Icons';

interface LibraryProps {
  onOpenBook: (id: number) => void;
  onEditBook: (id: number) => void;
  onAddBook: () => void;
}

export const Library: React.FC<LibraryProps> = ({ 
  onOpenBook, 
  onEditBook, 
  onAddBook 
}) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchBooks = async () => {
    try {
      setLoading(true);
      // Fetch books and sort by newest first
      const allBooks = await db.books.toArray();
      allBooks.sort((a, b) => b.dateAdded - a.dateAdded);
      setBooks(allBooks);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch books:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  // Listen for refresh triggers or db updates
  // Since other actions edit DB, we can export a way or refresh on mount/updates
  const handleDeleteBook = async (id: number, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await db.books.delete(id);
        await db.bookFiles.delete(id);
        fetchBooks();
      } catch (err) {
        console.error('Error deleting book:', err);
      }
    }
  };

  const filteredBooks = books.filter((book) => {
    const term = searchTerm.toLowerCase();
    return (
      book.title.toLowerCase().includes(term) ||
      book.author.toLowerCase().includes(term)
    );
  });

  return (
    <div className="library-screen">
      {/* Search Header */}
      <div className="library-header">
        <div className="library-title-row">
          <div>
            <h1>PDF Viewr</h1>
            <p className="library-subtitle">Your offline pocket library</p>
          </div>
        </div>
        
        <div className="search-bar">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search books or authors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="library-content">
        {loading ? (
          <div className="library-loader">
            <div className="spinner"></div>
            <p>Loading library...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="empty-state animate-fade-in">
            <div className="empty-icon-wrapper">
              <BookIcon size={48} className="empty-icon" />
            </div>
            {searchTerm ? (
              <>
                <h3>No Results Found</h3>
                <p>No books match "{searchTerm}"</p>
                <button className="btn btn-secondary" onClick={() => setSearchTerm('')}>
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <h3>Your Library is Empty</h3>
                <p>Upload a PDF ebook to start reading. Your files will be stored securely offline in your browser database.</p>
                <button className="btn btn-primary btn-upload-now" onClick={onAddBook}>
                  <PlusIcon size={18} /> Upload PDF Book
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="books-grid animate-fade-in">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onOpen={onOpenBook}
                onEdit={onEditBook}
                onDelete={handleDeleteBook}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      {!loading && books.length > 0 && (
        <button className="fab-btn" onClick={onAddBook} aria-label="Add Book">
          <PlusIcon size={24} />
        </button>
      )}
    </div>
  );
};

/* --- BOOK CARD COMPONENT --- */
interface BookCardProps {
  book: Book;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number, title: string) => void;
}

const BookCard: React.FC<BookCardProps> = ({ book, onOpen, onEdit, onDelete }) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCover = async () => {
      try {
        const fileData = await db.bookFiles.get(book.id!);
        if (fileData && fileData.coverBlob && isMounted) {
          const url = URL.createObjectURL(fileData.coverBlob);
          setCoverUrl(url);
        }
      } catch (err) {
        console.error(`Error loading cover for book ${book.id}:`, err);
      }
    };

    fetchCover();

    return () => {
      isMounted = false;
      if (coverUrl) {
        URL.revokeObjectURL(coverUrl);
      }
    };
  }, [book.id, book.hasCustomCover]);

  // Calculate percentage progress
  const progressPercent = Math.round((book.currentPage / book.totalPages) * 100) || 0;

  return (
    <div className="book-card" onClick={() => onOpen(book.id!)}>
      {/* Cover Artwork */}
      <div className="book-cover-wrapper">
        {coverUrl ? (
          <img src={coverUrl} alt={book.title} className="book-cover-img" loading="lazy" />
        ) : (
          <div className="book-cover-placeholder">
            <BookIcon size={32} />
          </div>
        )}
        
        {/* Visual Progress Badge */}
        {progressPercent > 0 && (
          <div className={`progress-badge ${progressPercent === 100 ? 'completed' : ''}`}>
            {progressPercent}% read
          </div>
        )}
      </div>

      {/* Book Metadata */}
      <div className="book-info">
        <h3 className="book-title">{book.title}</h3>
        <p className="book-author">{book.author}</p>
        
        {/* Progress bar info */}
        <div className="book-progress-section">
          <div className="progress-bar-track">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="progress-labels">
            <span>Page {book.currentPage} of {book.totalPages}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="book-card-actions" onClick={(e) => e.stopPropagation()}>
          <button 
            className="card-action-btn edit" 
            onClick={() => onEdit(book.id!)}
            title="Edit Cover / Details"
          >
            <EditIcon size={14} /> Change Cover
          </button>
          <button 
            className="card-action-btn delete" 
            onClick={() => onDelete(book.id!, book.title)}
            title="Delete Book"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
export default Library;
