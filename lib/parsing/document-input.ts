import {
  normalizeDocumentText,
  unreadableReason,
  type TextSource,
} from '../document-text';

/**
 * The one shape a document arrives in, whichever way the reader supplied it.
 *
 * An uploaded file is parsed in the browser and a pasted agreement is taken from
 * the clipboard, and both of them come through `documentInput` and leave as this:
 * a name and the text. Nothing on it records which way the reader chose, which is
 * why `analyzeDocument` takes text and has nowhere to learn where it came from
 * (ADR-0020).
 */
export interface DocumentInput {
  /** What the reader will recognise in their library. */
  name: string;
  text: string;
}

/** Raised with a reason written for the reader, not for a log. */
export class DocumentReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentReadError';
  }
}

/**
 * Text on its way in, normalised once and checked for being worth reading.
 *
 * Both input paths end here, so both normalise the same way and refuse on the
 * same grounds. What comes back is the text every source sentence is later
 * verified against (ADR-0001), so the wording inside it is left alone.
 *
 * `source` shapes the reason a refused reader is given and nothing else: it is
 * spent here and never travels with the text.
 */
export function documentInput(
  name: string,
  raw: string,
  source: TextSource,
): DocumentInput {
  const text = normalizeDocumentText(raw);

  const unreadable = unreadableReason(text, source);
  if (unreadable !== null) {
    throw new DocumentReadError(unreadable);
  }

  return { name, text };
}
