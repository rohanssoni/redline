/**
 * Finding a quoted sentence in the document it is supposed to have come from.
 *
 * This is the whole of ADR-0001's check. A quote either exists in the document
 * text or it does not; there is no third answer, no closest match and no score.
 *
 * ## The whitespace decision
 *
 * A PDF parser breaks a sentence across lines wherever the page did, so the same
 * sentence can arrive with a newline where the document has a space. Runs of
 * whitespace are therefore collapsed to one space **on both sides symmetrically**
 * before the comparison, and on nothing else: a changed letter, a changed case, a
 * changed or added punctuation mark, an inserted or dropped word all still fail.
 *
 * What comes back is always the span cut out of the **document**, never the quote
 * that was passed in, so the sentence stored and shown to the reader is the
 * document's own wording down to its punctuation.
 */

interface Collapsed {
  /** The text with every whitespace run reduced to a single space. */
  text: string;
  /** For each character in `text`, its index in the text it came from. */
  sourceIndex: number[];
}

const WHITESPACE = /\s/;

function collapseWhitespace(raw: string): Collapsed {
  let text = '';
  const sourceIndex: number[] = [];

  let index = 0;
  while (index < raw.length) {
    if (WHITESPACE.test(raw[index])) {
      const runStart = index;
      while (index < raw.length && WHITESPACE.test(raw[index])) index += 1;
      // A leading run is dropped rather than kept as a space, so a quote that
      // begins mid-line still lines up with the same sentence in the document.
      if (text.length > 0) {
        text += ' ';
        sourceIndex.push(runStart);
      }
      continue;
    }
    text += raw[index];
    sourceIndex.push(index);
    index += 1;
  }

  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    sourceIndex.pop();
  }

  return { text, sourceIndex };
}

/**
 * The document's own wording for `quote`, or `null` when the document does not
 * contain it. A quote found twice cites the first occurrence; both are the same
 * words, so either is verbatim.
 */
export function findSourceSentence(
  documentText: string,
  quote: string,
): string | null {
  const needle = collapseWhitespace(quote).text;
  if (needle.length === 0) return null;

  const haystack = collapseWhitespace(documentText);
  const at = haystack.text.indexOf(needle);
  if (at === -1) return null;

  const from = haystack.sourceIndex[at];
  const to = haystack.sourceIndex[at + needle.length - 1] + 1;
  return documentText.slice(from, to);
}

/** Whether the document contains this wording. */
export function containsSourceSentence(
  documentText: string,
  quote: string,
): boolean {
  return findSourceSentence(documentText, quote) !== null;
}
