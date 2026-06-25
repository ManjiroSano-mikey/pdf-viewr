import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker from standard CDN.
// In Vite projects, this is the most reliable way to load the PDF.js worker
// without run-time configuration issues or bundler warnings.
const PDFJS_VERSION = '4.2.67'; // Fallback version if version is not readable
try {
  const version = pdfjsLib.version || PDFJS_VERSION;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
} catch (e) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
}

export interface PDFInfo {
  title: string;
  author: string;
  totalPages: number;
}

/**
 * Extracts title, author and page count metadata from a PDF Blob.
 */
export async function extractPDFInfo(pdfBlob: Blob, defaultTitle: string): Promise<PDFInfo> {
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let title = '';
    let author = '';
    
    try {
      const meta = await pdf.getMetadata();
      if (meta && meta.info) {
        const info = meta.info as any;
        title = info.Title || '';
        author = info.Author || '';
      }
    } catch (e) {
      console.warn('Metadata extraction failed, falling back to defaults', e);
    }
    
    return {
      title: title.trim() || defaultTitle.replace(/\.pdf$/i, ''),
      author: author.trim() || 'Unknown Author',
      totalPages: pdf.numPages,
    };
  } catch (error) {
    console.error('Error reading PDF file details:', error);
    throw new Error('Failed to read PDF file details. Please make sure it is a valid PDF.');
  }
}

/**
 * Renders the first page of the PDF to a canvas and returns it as a JPEG Blob.
 */
export async function generatePDFCoverBlob(pdfBlob: Blob): Promise<Blob> {
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    if (pdf.numPages === 0) {
      throw new Error('PDF has no pages');
    }
    
    // Load page 1
    const page = await pdf.getPage(1);
    
    // We want a standard aspect ratio cover photo (like ~3:4).
    // Let's render page 1 at a scale that gives about 600px width for quality.
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2d context for cover generation');
    }
    
    // Render the page contents into canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    // Convert canvas back to a JPEG blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to Blob'));
          }
        },
        'image/jpeg',
        0.85 // High quality (85%)
      );
    });
  } catch (error) {
    console.error('Error generating cover image from PDF:', error);
    // Return a standard placeholder empty blob or throw
    throw error;
  }
}
