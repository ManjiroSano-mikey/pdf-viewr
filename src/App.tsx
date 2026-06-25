import { useState } from 'react';
import DeviceShell from './components/DeviceShell';
import Library from './components/Library';
import Reader from './components/Reader';
import BookUploadModal from './components/BookUploadModal';
import './App.css';

type Screen = 'library' | 'reader';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('library');
  const [activeBookId, setActiveBookId] = useState<number | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editBookId, setEditBookId] = useState<number | null>(null);
  const [libraryKey, setLibraryKey] = useState(0); // Used to trigger refresh

  const handleOpenBook = (bookId: number) => {
    setActiveBookId(bookId);
    setCurrentScreen('reader');
  };

  const handleCloseReader = () => {
    setActiveBookId(null);
    setCurrentScreen('library');
    // Force refresh the library progress bar metrics
    setLibraryKey((prev) => prev + 1);
  };

  const handleAddBookClick = () => {
    setEditBookId(null);
    setIsUploadOpen(true);
  };

  const handleEditBookClick = (bookId: number) => {
    setEditBookId(bookId);
    setIsUploadOpen(true);
  };

  const handleUploadSuccess = () => {
    // Increment the key to force re-render the Library and pull fresh data
    setLibraryKey((prev) => prev + 1);
  };

  return (
    <DeviceShell>
      {currentScreen === 'library' ? (
        <Library
          key={libraryKey}
          onOpenBook={handleOpenBook}
          onEditBook={handleEditBookClick}
          onAddBook={handleAddBookClick}
        />
      ) : (
        <Reader 
          bookId={activeBookId!} 
          onClose={handleCloseReader} 
        />
      )}

      {/* Global Upload / Edit Bottom Sheet */}
      <BookUploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setEditBookId(null);
        }}
        onSuccess={handleUploadSuccess}
        editBookId={editBookId}
      />
    </DeviceShell>
  );
}

export default App;
