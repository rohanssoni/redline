import {
  documentInput,
  DocumentReadError,
  type DocumentInput,
} from './document-input';

/**
 * The paste path: the reader's clipboard becomes the document text.
 *
 * What they pasted is stored as it stands, so it is exactly what every source
 * sentence is checked against (ADR-0001). Nothing else about the paste is kept,
 * and nothing on the way out says the text was pasted rather than uploaded
 * (ADR-0020).
 */

/** What the reader is told when the clipboard held a picture instead of words. */
export const PASTED_IMAGE_REASON =
  'That’s a picture, and Redline reads words it can copy. It would have to guess ' +
  'at the wording, and then every sentence it quoted back to you would be its ' +
  'guess rather than your agreement. Paste the words themselves, or upload the file.';

/** The name a pasted agreement falls back to when the reader leaves the box empty. */
export const UNNAMED_PASTE = 'Pasted agreement';

/** How much of a first line is worth keeping as a name. */
const NAME_LIMIT = 120;

/**
 * The reason this paste is refused, or `null` if there is nothing to refuse.
 *
 * A screenshot reaches the clipboard as a file, and reading one would take OCR,
 * which is excluded on purpose: a citation is worthless when the text under it
 * was misread. So the paste stops here, before anything is stored or analysed.
 *
 * Takes the media types of the files on the clipboard. A copied passage carries
 * none, however it was styled.
 */
export function pastedImageReason(fileTypes: readonly string[]): string | null {
  const image = fileTypes.some((type) => type.trim().toLowerCase().startsWith('image/'));
  return image ? PASTED_IMAGE_REASON : null;
}

/**
 * What a pasted agreement is called: what the reader typed, or the first line
 * they pasted, which is usually the agreement's own title.
 */
export function pastedDocumentName(given: string, text: string): string {
  const typed = given.trim();
  if (typed.length > 0) return typed;

  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean);
  if (!firstLine) return UNNAMED_PASTE;
  return firstLine.length > NAME_LIMIT
    ? `${firstLine.slice(0, NAME_LIMIT).trimEnd()}…`
    : firstLine;
}

/** A paste Redline will store, or the reason it will not. */
export type PasteOutcome =
  | { refused: string; document?: undefined }
  | { document: DocumentInput; refused?: undefined };

/**
 * What becomes of a paste: the document to store, or a reason for the reader.
 *
 * Every way a paste can be turned down runs through here, and a refusal comes
 * back as a value rather than a stored document, so there is no path on which a
 * refused paste is saved or analysed.
 */
export function readPaste(content: {
  name: string;
  text: string;
  /** Media types of any files on the clipboard. A screenshot is one. */
  fileTypes?: readonly string[];
}): PasteOutcome {
  const image = pastedImageReason(content.fileTypes ?? []);
  if (image !== null) return { refused: image };

  try {
    const input = documentInput('', content.text, 'pasted');
    return {
      document: {
        name: pastedDocumentName(content.name, input.text),
        text: input.text,
      },
    };
  } catch (error) {
    if (error instanceof DocumentReadError) return { refused: error.message };
    throw error;
  }
}
