import type { TextSource } from '../document-text';

/** The file kinds Redline can read in the browser. */
export type ParsableKind = Extract<TextSource, 'pdf' | 'docx'>;

interface NamedFile {
  name: string;
  type?: string;
}

/**
 * Which parser a file needs, or `null` when nothing here can read it. Extension
 * first, because browsers report `.docx` under several different media types and
 * sometimes under none at all.
 */
export function parsableKind(file: NamedFile): ParsableKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';

  const type = (file.type ?? '').toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (
    type ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  return null;
}

/** What a reader is told about a file Redline cannot open. */
export function unsupportedFileReason(file: NamedFile): string {
  const name = file.name.toLowerCase();
  if (name.endsWith('.doc')) {
    return 'Redline reads .docx files, and this one is the older .doc format. Open it in Word and save it again as .docx, or export it as a PDF.';
  }
  if (/\.(png|jpe?g|gif|heic|webp|tiff?|bmp)$/.test(name)) {
    return 'This is an image, and Redline reads text rather than pictures of it. Send the PDF or Word file the agreement came in.';
  }
  return 'Redline reads PDF and Word (.docx) files. This one is neither.';
}
