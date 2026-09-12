/**
 * The clean read: the result when a document produces no flags and no gaps above
 * the severity threshold (CONTEXT.md, ADR-0008).
 *
 * It is a first-class outcome, so it is a value rather than the absence of one.
 * The reason it is a *branded* value is the failure it exists to make impossible:
 * telling a reader their agreement is fine when the read actually broke. An empty
 * list cannot tell those two apart — `flags: []` is what a clean document and a
 * dead model call both look like from the outside — so the UI is never allowed to
 * ask "are the lists empty?". It asks whether there is a `CleanRead`, and only a
 * read that finished can hand it one.
 *
 * Three things hold that line, and none of them is a render-time decision:
 *
 * 1. **`CleanRead` is branded by a `unique symbol` this module never exports**,
 *    the same way `VerifiedFlag` and `Gap` are. `{ threshold: 20 }` does not
 *    satisfy it, anywhere, ever. `cleanReadFor` is the only producer.
 * 2. **`cleanReadFor` takes the stages, not their results.** A `VerificationOutcome`
 *    and a `GapCheckOutcome` are branded too, so the only way to call it is to
 *    hold a flag stage and a gap stage that each ran to the end. A caller in a
 *    `catch` block has neither, and cannot fabricate them from empty arrays.
 * 3. **The summary is required to be there.** A read with no summary has not
 *    produced the thing a clean read still shows, so it is not a clean read.
 *
 * A read that fails throws before any of this, and `analysis` stays null; the
 * reader gets the failure. There is no path from a broken analysis to a clean
 * read, because there is no way to build the argument `cleanReadFor` wants.
 */

import type { GapCheckOutcome } from './gap';
import type { VerificationOutcome } from './verified-flag';
import { SEVERITY_THRESHOLD, aboveThreshold } from './ranking';

/** Every stage of one read of one document, each having run to the end. */
export interface CompletedRead {
  /** The plain-English summary, which a clean read still shows. */
  summary: string;
  /** The flag stage's own outcome, which only `verifyFlags` can produce. */
  flagCheck: VerificationOutcome;
  /** The gap stage's own outcome, which only `verifyGaps` can produce. */
  gapCheck: GapCheckOutcome;
}

// Not exported: naming this key is the only way to write a `CleanRead` literal,
// and nothing outside this module can name it.
declare const everyStageRanAndFoundNothing: unique symbol;

/**
 * A document that a finished read found nothing in above the severity threshold.
 *
 * It carries the threshold it was measured against rather than a count of zero,
 * because the claim the reader is shown is about the bar, not about the tally.
 */
export type CleanRead = {
  /** The severity threshold nothing in this document reached. */
  readonly threshold: number;
} & { readonly [everyStageRanAndFoundNothing]: true };

/**
 * The clean read for a finished read, or `null` when the reader has findings to
 * work through instead.
 *
 * `null` here means "not a clean read" and never "the read broke": a read that
 * broke cannot reach this function, because it has no completed stages to pass.
 */
export function cleanReadFor(read: CompletedRead): CleanRead | null {
  if (read.summary.trim().length === 0) return null;

  const reportable =
    aboveThreshold(read.flagCheck.flags).length +
    aboveThreshold(read.gapCheck.gaps).length;
  if (reportable > 0) return null;

  return { threshold: SEVERITY_THRESHOLD } as CleanRead;
}
