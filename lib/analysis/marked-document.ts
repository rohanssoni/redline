/**
 * The document cut into what a reader sees marked and what they see plain.
 *
 * A flag is drawn on the page only where its source sentence actually sits in
 * the text, so the highlight, the change bar and the rank all point at the
 * sentence the flag quotes. A flag whose sentence is not in this text is left
 * off the page rather than drawn somewhere near enough, which is ADR-0001 again
 * at the last place it could be broken.
 */

import type { Flag } from './verified-flag';

/** A flag and where it sits: rank 1 is the worst. */
export interface MarkedFlag {
  flag: Flag;
  rank: number;
  at: number;
}

export type DocumentPiece =
  | { kind: 'text'; text: string }
  | { kind: 'flag'; text: string; marked: MarkedFlag };

export interface MarkedDocument {
  /** The document in order, flagged sentences cut out of it. */
  pieces: DocumentPiece[];
  /** The flags that are on the page, worst first. */
  marked: MarkedFlag[];
}

/**
 * Marks up `text` with `flags`, which arrive worst first. Overlapping flags keep
 * the earlier one, so no sentence is drawn twice.
 *
 * `rankOf` is how a caller says what number a flag wears on the page. It defaults
 * to the flag's place among the flags, and the reader's page passes the flag's
 * place in the one ranked list it shares with the gaps (ADR-0005), so a gap
 * ranked above a flag pushes that flag's numeral down rather than being left out
 * of the count.
 */
export function markUpDocument(
  text: string,
  flags: readonly Flag[],
  rankOf: (flag: Flag, index: number) => number = (_flag, index) => index + 1,
): MarkedDocument {
  const found: MarkedFlag[] = flags
    .map((flag, index) => ({
      flag,
      rank: rankOf(flag, index),
      at: text.indexOf(flag.sourceSentence),
    }))
    .filter((each) => each.at >= 0 && each.flag.sourceSentence.length > 0)
    .sort((a, b) => a.at - b.at);

  const pieces: DocumentPiece[] = [];
  const marked: MarkedFlag[] = [];
  let cursor = 0;

  for (const each of found) {
    if (each.at < cursor) continue;
    if (each.at > cursor) {
      pieces.push({ kind: 'text', text: text.slice(cursor, each.at) });
    }
    pieces.push({ kind: 'flag', text: each.flag.sourceSentence, marked: each });
    marked.push(each);
    cursor = each.at + each.flag.sourceSentence.length;
  }

  if (cursor < text.length) {
    pieces.push({ kind: 'text', text: text.slice(cursor) });
  }

  return { pieces, marked: [...marked].sort((a, b) => a.rank - b.rank) };
}

/** The lines of a stretch of document text, blank ones dropped. */
export function textLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
