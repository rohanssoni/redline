/**
 * The gate every gap passes through before a reader can see it (ADR-0005).
 *
 * A gap is a term the agreement does not contain. There is no sentence to quote,
 * so a gap makes a weaker and differently shaped claim than a flag: it is checked
 * against the whole document rather than against one span of it.
 *
 * Two things hold that line, and neither of them is a render-time decision:
 *
 * 1. **A gap has no place to put a source sentence.** `GapClaim.sourceSentence`
 *    is declared `?: never`, so `gap.sourceSentence = someQuote` does not
 *    compile, anywhere, ever. A later ticket cannot hand a gap a citation by
 *    accident, because the field it would reach for cannot hold one.
 * 2. **Only `verifyGaps` can make the type `AnalysisResult.gaps` holds.** The
 *    brand is keyed by a `unique symbol` this module never exports, mirroring
 *    `VerifiedFlag`, so a gap reaches the reader only through the check below.
 *
 * The check itself is the whole-document counterpart of ADR-0001's quote check,
 * run the other way round: a flag is dropped when the document does *not* contain
 * its sentence, and a gap is dropped when the document *does* contain its words.
 * A statement that repeats a run of the agreement's own wording is quoting it,
 * which is the one thing a gap may never do.
 */

import { containsSourceSentence } from './source-sentence';
import type { SeverityBand } from './verified-flag';

/**
 * A term the agreement does not contain, stated as a claim about the whole
 * document ("This agreement contains no late-payment term.").
 */
export interface GapClaim {
  id: string;
  severity: number;
  band: SeverityBand;
  /** A whole-document claim. Never a quotation, and never about one sentence. */
  statement: string;
  /** What the absence costs the reader, in the reader's own terms. */
  explanation: string;
  /**
   * A gap has no source sentence, because there is no sentence (CONTEXT.md).
   * The field is declared here, as `never`, so that code trying to give a gap a
   * citation fails to compile rather than quietly adding a key nobody expected.
   */
  sourceSentence?: never;
}

// Not exported: naming this key is the only way to write a `Gap` literal, and
// nothing outside this module can name it.
declare const checkedAgainstTheWholeDocument: unique symbol;

/**
 * A gap whose statement has been checked against the document and found to be
 * describing what is absent rather than repeating what is present.
 */
export type Gap = GapClaim & {
  readonly [checkedAgainstTheWholeDocument]: true;
};

/** A gap that was dropped, and why. For the log, never for the reader. */
export interface DroppedGap {
  id: string;
  /** The statement the model made, which the check refused. */
  claimed: string;
  reason: string;
}

// Not exported, mirroring the flag stage: a `GapCheckOutcome` is evidence that
// the gap stage ran to the end, so nothing outside this module can write one.
declare const theGapStageRanToTheEnd: unique symbol;

/**
 * What the gap stage produced, and proof that it produced it. Only `verifyGaps`
 * can make one, so an empty `gaps` here means the stage looked and found nothing
 * rather than that nobody looked (ADR-0008).
 */
export type GapCheckOutcome = {
  /** Every gap that may be shown. */
  gaps: Gap[];
  /** Every gap that may not, with the statement that failed. */
  dropped: DroppedGap[];
} & { readonly [theGapStageRanToTheEnd]: true };

/**
 * How many of the document's own words in a row make a statement a quotation.
 *
 * Short overlaps are unavoidable — a gap about late payment says "payment", and
 * so does the agreement — so the run has to be long enough that hitting it by
 * chance is not a thing plain English does. Six words of an agreement in the same
 * order is a lifted phrase, not a coincidence.
 */
export const QUOTED_RUN_WORDS = 6;

/**
 * Whether `statement` repeats a run of the document's own wording. Compared
 * through `containsSourceSentence`, so line breaks from a PDF do not hide a
 * quotation and nothing else about the wording is forgiven.
 */
export function quotesTheDocument(
  statement: string,
  documentText: string,
): boolean {
  const words = statement.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return false;

  const run = Math.min(QUOTED_RUN_WORDS, words.length);
  for (let start = 0; start + run <= words.length; start += 1) {
    if (containsSourceSentence(documentText, words.slice(start, start + run).join(' '))) {
      return true;
    }
  }
  return false;
}

/**
 * Keeps the gaps that describe what the document leaves out, and drops the rest
 * outright. A dropped gap is not reworded, not demoted and not passed on.
 *
 * Every kept gap is rebuilt field by field rather than spread, so a stray key
 * from a model reply or from a stored row — `sourceSentence` above all — has no
 * way through. The type forbids it; this makes the runtime agree.
 */
export function verifyGaps(
  proposed: readonly GapClaim[],
  documentText: string,
): GapCheckOutcome {
  const gaps: Gap[] = [];
  const dropped: DroppedGap[] = [];

  for (const gap of proposed) {
    const statement = gap.statement.trim();
    const reason = refusalFor(gap, statement, documentText);
    if (reason !== null) {
      dropped.push({ id: gap.id, claimed: gap.statement, reason });
      continue;
    }

    gaps.push({
      id: gap.id,
      severity: gap.severity,
      band: gap.band,
      statement,
      explanation: gap.explanation.trim(),
    } as Gap);
  }

  return { gaps, dropped } as GapCheckOutcome;
}

/** Why this gap cannot be shown, or `null` when it can. */
function refusalFor(
  gap: GapClaim,
  statement: string,
  documentText: string,
): string | null {
  if (statement.length === 0) {
    return 'the gap states nothing';
  }
  // Unreachable through the type, which is the point. A row in the database or a
  // reply that got past its schema can still carry the key, and a gap carrying a
  // quote is the one failure ADR-0005 exists to prevent.
  if ((gap as { sourceSentence?: unknown }).sourceSentence !== undefined) {
    return 'a gap arrived carrying a source sentence';
  }
  if (quotesTheDocument(statement, documentText)) {
    return 'the statement quotes the document instead of saying what is absent';
  }
  return null;
}
