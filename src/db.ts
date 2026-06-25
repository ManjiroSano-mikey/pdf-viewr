import Dexie, { type Table } from 'dexie';

export interface Book {
  id?: number;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  dateAdded: number;
  hasCustomCover: boolean;
}

export interface BookFile {
  bookId: number; // reference to Book.id
  pdfBlob: Blob;
  coverBlob: Blob; // generated canvas blob or custom cover image blob
}

class PDFViewrDatabase extends Dexie {
  books!: Table<Book>;
  bookFiles!: Table<BookFile>;

  constructor() {
    super('PDFViewrDatabase');
    this.version(1).stores({
      books: '++id, title, author, dateAdded',
      bookFiles: 'bookId',
    });
  }
}

export const db = new PDFViewrDatabase();
