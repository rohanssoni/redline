import {
  normalizeDocumentText,
  unreadableReason,
  type TextSource,
} from '../document-text';
import { parsableKind, unsupportedFileReason, type ParsableKind } from './file-kind';
import { assemblePdfText, type PdfTextItem } from './pdf-text';

/**
 * Parsing happens here, in the browser, and nowhere else. The file itself never
 * leaves the reader's machine: what comes out of this module is text, and text
 * is the only thing the server is ever sent (`CLAUDE.md`, settled).
 */

export interface ExtractedDocument {
  /** The file's own name, kept so the reader recognises it in their library. */
  name: string;
  kind: ParsableKind;
  text: string;
}

/** Raised with a reason written for the reader, not for a log. */
export class DocumentReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentReadError';
  }
}

export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  const kind = parsableKind(file);
  if (kind === null) {
    throw new DocumentReadError(unsupportedFileReason(file));
  }

  const buffer = await file.arrayBuffer();
  const raw = kind === 'pdf' ? await readPdf(buffer) : await readDocx(buffer);
  const text = normalizeDocumentText(raw);

  const unreadable = unreadableReason(text, kind as TextSource);
  if (unreadable !== null) {
    throw new DocumentReadError(unreadable);
  }

  return { name: file.name, kind, text };
}

/** Where the pdf.js worker is served from. Copied into `public` at install. */
export const PDF_WORKER_PATH = '/pdf.worker.min.mjs';

async function readPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_PATH;

  const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const document = await task.promise;
  try {
    const pages: PdfTextItem[][] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(
        content.items.flatMap((item) =>
          'str' in item ? [{ str: item.str, hasEOL: item.hasEOL }] : [],
        ),
      );
      page.cleanup();
    }
    return assemblePdfText(pages);
  } finally {
    await task.destroy();
  }
}

async function readDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = (await import('mammoth')).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return value;
}
