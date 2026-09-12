/**
 * The zero-flag rate: how much of what Redline reads comes back as a clean read
 * (ADR-0008), and what that share is currently being compared against.
 *
 * It exists to catch one failure nothing else in the product would show. A
 * severity filter that starts suppressing too hard produces documents that look
 * fine — no flags, no error, a summary and a clean read — and every one of them
 * is a reader told their agreement is safe. The only symptom is the share of
 * clean reads climbing, so the share is written down for every finished read and
 * compared against something.
 *
 * It is a health metric, not a target to move. Nothing here is better for being
 * lower: a corpus of genuinely clean agreements has a high zero-flag rate and a
 * product that flagged every sentence of every document would have a rate of
 * zero. What is worth reading is movement away from the baseline, which is why
 * the number never travels without `ZERO_FLAG_SIGNAL_NOTE`.
 *
 * What it is compared against changes once, and the change is given by ADR-0011
 * and ADR-0016 rather than decided here:
 *
 * - A **fixed 20%** baseline to begin with, a provisional number held because a
 *   metric with no baseline catches nothing during the exact period a broken
 *   filter is most likely to ship unnoticed.
 * - **Rolling** after the switchover, which fires at 500 finished reads or 90
 *   days since launch, whichever comes first.
 *
 * Both comparisons are built. `comparisonInForce` is the whole of the decision
 * between them, it is pure, and it takes the count and the elapsed time as
 * arguments — no clock, no query, nothing to reach for.
 */

/** Where a share with nothing under it is reported as `null` rather than 0. */
export type Share = number | null;

/**
 * One finished read, as the metric counts it: whether it came back clean, and
 * when it was recorded.
 *
 * `cleanRead` is a boolean here and a `CleanRead | null` in the analysis. That
 * is the whole of what this metric needs, and keeping the branded value out of
 * the row means no path from a stored row back to a value the product treats as
 * proof that a read finished (`lib/analysis/clean-read.ts`).
 */
export interface FinishedRead {
  cleanRead: boolean;
  /** When the read finished, ISO 8601. */
  recordedAt: string;
}

/** The shape of a row in the `analysis_reads` table. */
export interface FinishedReadRow {
  id: string;
  clean_read: boolean;
  created_at: string;
}

/** Which baseline the zero-flag rate is currently being compared against. */
export type Comparison = 'fixed' | 'rolling';

/**
 * The fixed baseline, as a share of finished reads (ADR-0011).
 *
 * A provisional starting point, not a validated target, and not a number to
 * tune: ADR-0011 asks for it to be superseded once real documents have gone
 * through the pipeline, rather than edited here.
 */
export const FIXED_BASELINE = 0.2;

/** Finished reads after which the rolling comparison takes over (ADR-0016). */
export const SWITCHOVER_READS = 500;

/** Days since launch after which the rolling comparison takes over (ADR-0016). */
export const SWITCHOVER_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many of the most recent reads the rate is measured over once the rolling
 * comparison is in force, and how many before those the baseline is measured
 * over.
 *
 * The same 500 as the switchover, deliberately, and no second number invented
 * here: ADR-0016 vouches for 500 as a volume that estimates this rate tightly
 * enough to read, and nothing in the ADRs vouches for any other. Two windows of
 * equal size also means the comparison is like against like — a recent stretch
 * against the stretch before it — rather than a short run against a long average
 * that would absorb it.
 */
export const ROLLING_WINDOW_READS = SWITCHOVER_READS;

/** What the rate is worth, said wherever the rate is reported. */
export const ZERO_FLAG_SIGNAL_NOTE =
  'Watch this share; don’t try to move it. A clean read is a real result, and a run of genuinely fair agreements raises the share on its own. The gap against the baseline is the part to read: when the severity filter starts suppressing everything, the documents it breaks come back looking fine, and a climbing share is the only place that shows. The 20% baseline was guessed before any document had been read (ADR-0011), so a gap against it means go and read some of the reads, not that something is broken.';

/** Raised when a finished read cannot be recorded, or the rate cannot be read. */
export class ZeroFlagRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZeroFlagRateError';
  }
}

/**
 * Recording that a read finished. Writes only: a reader is never shown this
 * rate, so there is nothing here to show it with, the same way the copy counts
 * are not in the copies gateway.
 */
export interface ZeroFlagLogGateway {
  record(read: Pick<FinishedRead, 'cleanRead'>): Promise<void>;
}

/**
 * Which comparison is in force, and which threshold put it there.
 *
 * Pure, and the only place the switchover is decided. It takes the two numbers
 * ADR-0016 names and nothing else — no clock, no rows, no database — so the
 * rule can be read in one place and driven to either side of either threshold
 * in a test without waiting 90 days for one of them.
 *
 * `sinceLaunchMs` is `null` when nothing has launched yet, which is a real
 * state: launch is the first finished read (see `zeroFlagRateOf`), so before
 * there is one there is no elapsed time and the count threshold is the only one
 * that could fire — and with no reads it has not.
 */
export interface SwitchoverDecision {
  comparison: Comparison;
  /** Whether 500 finished reads have been recorded. */
  reachedReadCount: boolean;
  /** Whether 90 days have passed since launch. */
  reachedElapsedTime: boolean;
}

export function comparisonInForce(
  readsAnalyzed: number,
  sinceLaunchMs: number | null,
): SwitchoverDecision {
  const reachedReadCount = readsAnalyzed >= SWITCHOVER_READS;
  const reachedElapsedTime =
    sinceLaunchMs !== null && sinceLaunchMs >= SWITCHOVER_DAYS * DAY_MS;

  return {
    comparison: reachedReadCount || reachedElapsedTime ? 'rolling' : 'fixed',
    reachedReadCount,
    reachedElapsedTime,
  };
}

/** The zero-flag rate as it is reported, with what it is being measured against. */
export interface ZeroFlagRate {
  /** Finished reads recorded, all of them. */
  analyzed: number;
  /** Finished reads the rate below was measured over. */
  windowReads: number;
  /** How many of those came back clean. */
  windowCleanReads: number;
  /** The share of the window that came back clean, or `null` with nothing read. */
  zeroFlagRate: Share;
  /** Which baseline is in force (ADR-0016). */
  comparison: Comparison;
  /**
   * What the rate is being compared against: 20% while the fixed comparison is
   * in force, and the preceding window's own rate once the rolling one is.
   *
   * `null` where the rolling comparison has taken over but nothing has been
   * recorded before the current window yet. There is no history to compare
   * against at that point, and 0 would read as "nothing used to come back clean".
   */
  baseline: Share;
  /** The rate less the baseline, or `null` where either is missing. */
  drift: Share;
  /** When the first read was recorded, which is what launch means here. */
  launchedAt: string | null;
  /** What the number is worth, carried with it wherever it is reported. */
  note: string;
}

/**
 * The rate over a set of finished reads, as of a given moment.
 *
 * `now` is an argument rather than a call to the clock, because the switchover
 * turns on elapsed time and a rule that reads the clock itself can only be
 * tested by waiting for it.
 *
 * **Launch is the first finished read Redline recorded.** The alternative was a
 * timestamp in configuration, which is a value someone has to remember to set
 * and which reads as launched while nothing has been read. The first read is a
 * fact the metric already holds, it cannot drift out of date, and before there
 * is one there is honestly no launch to count 90 days from.
 *
 * With nothing recorded every share is `null` rather than 0. A rate of zero is a
 * claim that no document came back clean, and nothing has been read.
 */
export function zeroFlagRateOf(
  reads: readonly FinishedRead[],
  now: Date,
): ZeroFlagRate {
  const ordered = [...reads].sort((a, b) =>
    a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0,
  );
  const launchedAt = ordered[0]?.recordedAt ?? null;
  const sinceLaunchMs =
    launchedAt === null ? null : now.getTime() - Date.parse(launchedAt);

  const { comparison } = comparisonInForce(ordered.length, sinceLaunchMs);

  // Newest first, so "the current window" is the most recent reads and "the
  // window before it" is the stretch they are compared against.
  const recent = [...ordered].reverse();
  const current = recent.slice(0, ROLLING_WINDOW_READS);
  const preceding = recent.slice(
    ROLLING_WINDOW_READS,
    ROLLING_WINDOW_READS * 2,
  );

  const zeroFlagRate = shareCleanOf(current);
  const baseline =
    comparison === 'fixed' ? FIXED_BASELINE : shareCleanOf(preceding);

  return {
    analyzed: ordered.length,
    windowReads: current.length,
    windowCleanReads: current.filter((read) => read.cleanRead).length,
    zeroFlagRate,
    comparison,
    baseline,
    drift:
      zeroFlagRate === null || baseline === null
        ? null
        : zeroFlagRate - baseline,
    launchedAt,
    note: ZERO_FLAG_SIGNAL_NOTE,
  };
}

/** The share of a stretch of reads that came back clean, or `null` if it is empty. */
function shareCleanOf(reads: readonly FinishedRead[]): Share {
  if (reads.length === 0) return null;
  return reads.filter((read) => read.cleanRead).length / reads.length;
}

/** Turns a row into a finished read. */
export function toFinishedRead(
  row: Pick<FinishedReadRow, 'clean_read' | 'created_at'>,
): FinishedRead {
  return { cleanRead: row.clean_read, recordedAt: row.created_at };
}
