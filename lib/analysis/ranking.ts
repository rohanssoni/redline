/**
 * What reaches the list, and in what order (ADR-0004, ADR-0006).
 *
 * Two rules, applied in this order:
 *
 * 1. **Plausibility, before ranking.** A clause is dangerous when it lets the
 *    other side change the reader's economics on its own, after the reader is
 *    committed. A clause that binds both sides in the same way is not dangerous,
 *    however unusual it is, and it is dropped rather than ranked low.
 * 2. **Severity is consequence, not frequency.** What survives is ordered by what
 *    it costs the reader if it fires.
 *
 * Partial confidence is not a filter. A clause that passed rule 1 and can be
 * cited is flagged even where the reading is only partly confident (ADR-0006);
 * the reader has the sentence in front of them and can dismiss it in seconds.
 */

import type { Gap, GapClaim } from './gap';
import type { Flag, ProposedFlag, SeverityBand, VerifiedFlag } from './verified-flag';

/** At or above this, a flag is worth the reader's attention first. */
export const HIGH_BAND_FLOOR = 65;
/** At or above this, a flag is worth reading. Below it, worth knowing. */
export const MEDIUM_BAND_FLOOR = 35;

/** The band the reader sees for a severity. */
export function bandFor(severity: number): SeverityBand {
  if (severity >= HIGH_BAND_FLOOR) return 'high';
  if (severity >= MEDIUM_BAND_FLOOR) return 'medium';
  return 'low';
}

/**
 * Whether this clause is dangerous rather than merely unusual (ADR-0004). An odd
 * governing law or an odd notice address binds both sides identically and
 * changes nobody's economics, so it is not dangerous and never appears.
 */
export function isDangerousToTheReader(flag: ProposedFlag): boolean {
  return flag.changesYourEconomicsUnilaterally && !flag.bindsBothSidesEqually;
}

/** The flags that clear the plausibility filter. The rest are gone, not demoted. */
export function dangerousOnly(
  proposed: readonly ProposedFlag[],
): ProposedFlag[] {
  return proposed.filter(isDangerousToTheReader);
}

/**
 * Worst first, with one flag per source sentence: two readings of the same
 * sentence would give the reader the same quote twice, so the graver one stands.
 * Ties break on id, so the same analysis always lists in the same order.
 */
export function rankFlags(flags: readonly VerifiedFlag[]): VerifiedFlag[] {
  const worstPerSentence = new Map<string, VerifiedFlag>();
  for (const flag of flags) {
    const standing = worstPerSentence.get(flag.sourceSentence);
    if (!standing || flag.severity > standing.severity) {
      worstPerSentence.set(flag.sourceSentence, flag);
    }
  }

  return [...worstPerSentence.values()].sort(
    (a, b) => b.severity - a.severity || a.id.localeCompare(b.id),
  );
}

/**
 * Worst first, with one gap per statement: the same absence claimed twice would
 * read to the reader as two separate holes in the agreement.
 */
export function rankGaps(gaps: readonly Gap[]): Gap[] {
  const worstPerStatement = new Map<string, Gap>();
  for (const gap of gaps) {
    const standing = worstPerStatement.get(gap.statement);
    if (!standing || gap.severity > standing.severity) {
      worstPerStatement.set(gap.statement, gap);
    }
  }

  return [...worstPerStatement.values()].sort(
    (a, b) => b.severity - a.severity || a.id.localeCompare(b.id),
  );
}

/** A flag in the one ranked list the reader reads. */
export interface RankedFlag {
  kind: 'flag';
  rank: number;
  id: string;
  severity: number;
  flag: Flag;
}

/** A gap in that same list. It has no `sourceSentence` to carry (ADR-0005). */
export interface RankedGap {
  kind: 'gap';
  rank: number;
  id: string;
  severity: number;
  gap: GapClaim;
}

/** One item in the ranked list, which is either a flag or a gap and never both. */
export type Finding = RankedFlag | RankedGap;

/**
 * The single list the reader works down: flags and gaps interleaved, worst
 * first, numbered from 1 (ADR-0005).
 *
 * Severity decides the order and nothing else does, so a severe missing
 * protection sits above a minor flagged clause. What each item is allowed to
 * claim travels with its `kind`, not with its position: rank 1 being a gap makes
 * it the first thing to read, never a citable flag. Ties break on id, so the same
 * analysis always lists in the same order.
 */
export function rankFindings(
  flags: readonly Flag[],
  gaps: readonly GapClaim[],
): Finding[] {
  const items: Omit<Finding, 'rank'>[] = [
    ...flags.map((flag) => ({
      kind: 'flag' as const,
      id: flag.id,
      severity: flag.severity,
      flag,
    })),
    ...gaps.map((gap) => ({
      kind: 'gap' as const,
      id: gap.id,
      severity: gap.severity,
      gap,
    })),
  ];

  return items
    .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id))
    .map((item, index) => ({ ...item, rank: index + 1 }) as Finding);
}
