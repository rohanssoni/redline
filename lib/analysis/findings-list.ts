/**
 * What both review screens show, and in what order (ADR-0024).
 *
 * The findings list opens in document order: flags in the order their source
 * sentences appear on the page, then the gaps. Its number is then the finding's
 * place, so a severity band says how bad each flag is. Worst first is the
 * ranked order from `rankFindings`, where the number is the rank and the
 * position says how bad it is.
 *
 * The page marks take their numbers from here too, so the number on an entry and
 * the number on its sentence cannot disagree in either order.
 */

import { markUpDocument, type DocumentPiece } from './marked-document';
import { rankFindings, type Finding, type RankedGap } from './ranking';
import type { GapClaim } from './gap';
import type { Flag } from './verified-flag';

export type FindingsOrder = 'document' | 'worst';

/** One entry in the findings list. */
export interface ListEntry {
  finding: Finding;
  /** What the reader sees beside it: its place on the page, or its rank. */
  number: number;
  /** In document order the number no longer says how bad a flag is, so the band does. */
  showBand: boolean;
}

/** A gap's entry, for its note at the foot of the page. */
export type GapEntry = ListEntry & { finding: RankedGap };

export interface ReviewLayout {
  /** The page, top to bottom. Each mark carries its finding's rank. */
  pieces: DocumentPiece[];
  /** The findings list, in the order asked for. */
  entries: ListEntry[];
  /** The listed gaps, for the foot of the page, in the order the list shows them. */
  gaps: GapEntry[];
  /** The number the reader sees for the finding with this rank, on the page and in the list. */
  numberOf: (rank: number) => number;
}

export function layOutReview<F extends Flag, G extends GapClaim>(
  text: string,
  flags: readonly F[],
  gaps: readonly G[],
  order: FindingsOrder,
): ReviewLayout {
  const findings = rankFindings(flags, gaps);
  // Flags only: a gap may share a flag's id, and must never take its mark.
  const rankOf = new Map(
    findings.flatMap((finding) => (finding.kind === 'flag' ? [[finding.id, finding.rank] as const] : [])),
  );
  const { pieces } = markUpDocument(text, flags, (flag, index) => rankOf.get(flag.id) ?? index + 1);
  const byRank = new Map(findings.map((finding) => [finding.rank, finding]));

  const onThePage = pieces.flatMap((piece) =>
    piece.kind === 'flag' ? [byRank.get(piece.marked.rank)!] : [],
  );
  const gapFindings = findings.filter((finding) => finding.kind === 'gap');

  // A flag Redline could not place on the page is not offered in the list
  // either, so the reader is never given a number with nothing behind it.
  const listed = new Set<Finding>([...onThePage, ...gapFindings]);

  const entries: ListEntry[] =
    order === 'worst'
      ? findings
          .filter((finding) => listed.has(finding))
          .map((finding) => ({ finding, number: finding.rank, showBand: false }))
      : [...onThePage, ...gapFindings].map((finding, index) => ({
          finding,
          number: index + 1,
          showBand: finding.kind === 'flag',
        }));

  const numbers = new Map(entries.map((entry) => [entry.finding.rank, entry.number]));

  return {
    pieces,
    entries,
    gaps: entries.filter((entry): entry is GapEntry => entry.finding.kind === 'gap'),
    numberOf: (rank) => numbers.get(rank) ?? rank,
  };
}
