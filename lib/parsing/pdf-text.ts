/** One run of characters pdf.js found on a page. */
export interface PdfTextItem {
  str: string;
  /** pdf.js sets this on the last item of a visual line. */
  hasEOL?: boolean;
}

/**
 * Turns pdf.js's per-page text items back into paragraphs.
 *
 * pdf.js hands back positioned runs, not sentences: one visual line arrives as
 * several items, and a paragraph arrives as several lines broken wherever the
 * page happened to wrap. Every source sentence quoted later is checked verbatim
 * against this text (ADR-0001), so a sentence left split across two lines is a
 * citation that cannot be matched. Wrapped lines are rejoined; a line that ends
 * a sentence, a heading, and a numbered clause opener all stand on their own.
 */
export function assemblePdfText(pages: PdfTextItem[][]): string {
  return pages
    .map((items) => reflow(linesOf(items)))
    .filter((page) => page.length > 0)
    .join('\n\n');
}

function linesOf(items: PdfTextItem[]): string[] {
  const lines: string[] = [];
  let line = '';
  for (const item of items) {
    line += item.str;
    if (item.hasEOL) {
      lines.push(line.trim());
      line = '';
    }
  }
  if (line.trim().length > 0) lines.push(line.trim());
  return lines;
}

/** A line that ends here: sentence punctuation, or a colon before a list. */
const ENDS_A_LINE = /[.!?:;"”')\]]$/;
/** A heading, a clause number, or a signature rule: never joined to the line above. */
const STARTS_A_BLOCK = /^(\d+[.)]|\(?[a-z][.)]\s|[IVX]+\.|_{3,}|[A-Z][A-Z0-9 ,.'&-]{5,}$)/;

/** A short line with no lower-case in it: a clause heading, not a wrapped sentence. */
function isHeading(line: string): boolean {
  return line.length <= 90 && /[A-Z]/.test(line) && !/[a-z]/.test(line);
}

function reflow(lines: string[]): string {
  const out: string[] = [];
  let paragraph = '';

  const flush = () => {
    if (paragraph.trim().length > 0) out.push(paragraph.trim());
    paragraph = '';
  };

  for (const line of lines) {
    if (line.length === 0) {
      flush();
      continue;
    }
    if (paragraph.length === 0) {
      paragraph = line;
      continue;
    }
    if (ENDS_A_LINE.test(paragraph) || isHeading(paragraph) || STARTS_A_BLOCK.test(line)) {
      flush();
      paragraph = line;
      continue;
    }
    paragraph = paragraph.endsWith('-')
      ? paragraph.slice(0, -1) + line
      : `${paragraph} ${line}`;
  }
  flush();

  return out.join('\n');
}
