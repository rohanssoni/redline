/**
 * The text of a document, and what makes it usable.
 *
 * Whatever comes out of the browser parser is the text every source sentence is
 * later checked against (ADR-0001), so it is normalised once, here, on the way
 * in — and never again afterwards.
 */

/** Below this many readable characters there is nothing worth analysing. */
export const MINIMUM_READABLE_CHARACTERS = 200;

/** Where the text came from. Shapes the reason a reader is given. */
export type TextSource = 'pdf' | 'docx' | 'pasted';

/** Non-breaking, figure and narrow spaces, which parsers emit freely. */
const ODD_SPACES = /[     ]/g;

/**
 * Line endings to `\n`, runs of spaces and tabs to one space, trailing spaces
 * off, and no more than one blank line in a row. Sentence wording is untouched,
 * so a citation into this text stays verbatim.
 */
export function normalizeDocumentText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(ODD_SPACES, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Characters that carry meaning, ignoring layout. */
export function readableCharacterCount(text: string): number {
  return text.replace(/\s+/g, '').length;
}

/**
 * The reason this text cannot be read, or `null` if it can be. A scanned or
 * photographed page comes back from the parser as nothing at all, and there is
 * no OCR, so it is refused here rather than analysed into misread citations.
 */
export function unreadableReason(text: string, source: TextSource): string | null {
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  if (readableCharacterCount(text) >= MINIMUM_READABLE_CHARACTERS && letters > 0) {
    return null;
  }

  if (source === 'pasted') {
    return 'There is not enough text here to read. Paste the wording of the agreement itself rather than a screenshot of it.';
  }
  return 'There is almost no text in this file, which usually means its pages are scans or photographs. Redline reads words, so there is nothing here for it to read. A file saved out of a word processor will work.';
}
