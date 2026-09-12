/**
 * The red line override: a clause that violates something the reader already
 * decided they will not accept is shown, whatever the filters would have done
 * with it (ADR-0013).
 *
 * Two filters are bypassed and one gate is not, and the shape of this module is
 * what keeps that true:
 *
 * - **Bypassed:** the plausibility filter of ADR-0004, which happens before this
 *   module is reached — a red line match never goes through `dangerousOnly` —
 *   and the severity threshold of ADR-0008, which happens here.
 * - **Not bypassed:** the source sentence check of ADR-0001. This module takes
 *   `VerifiedFlag`s, the type only `verifyFlags` can produce, so a match whose
 *   quoted sentence is not in the document has no way to arrive. There is no
 *   argument that carves an exception, because there is no argument that could
 *   carry an unverified flag in the first place.
 *
 * The record of which red line caught which flag is built from the flags that
 * came out, never from the matches that went in, so a match that lost its
 * sentence at the gate leaves nothing behind either.
 */

import { clearsSeverityThreshold, rankFlags } from './ranking';
import type { VerifiedFlag } from './verified-flag';

/**
 * One flag a red line put in front of the reader, and the red line that did it.
 *
 * Internal. The reader sees an ordinary flag with its source sentence and
 * nothing else: no badge, no marker, nothing that reads as a hedge about the
 * match (ADR-0010). This record exists for the judge (ADR-0018) and for the
 * dismissal rate, which is read separately for red-line-triggered flags because
 * a reader dismissing their own stated red line means something different from
 * a reader dismissing a borderline one (ADR-0013).
 */
export interface RedLineMatch {
  /** The `id` of the flag in `AnalysisResult.flags`. */
  flagId: string;
  /** The red line it violates, in the reader's own words. */
  redLine: string;
  /** The document's own sentence, as the flag carries it. */
  sourceSentence: string;
}

/**
 * The flags the reader is shown, and which red line put each of them there.
 *
 * `redLineBySentence` maps a verified source sentence to the red line it
 * violates. It is keyed by sentence rather than by flag id because the mark
 * belongs to the clause: where the same sentence came back from both the flag
 * stage and the red line stage, one flag is shown for it (`rankFlags`), and it
 * stays marked whichever of the two ends up being the one shown.
 */
export function applyRedLineOverride(
  verified: readonly VerifiedFlag[],
  redLineBySentence: ReadonlyMap<string, string>,
): { flags: VerifiedFlag[]; redLineMatches: RedLineMatch[] } {
  const flags = rankFlags(
    verified.filter(
      (flag) =>
        clearsSeverityThreshold(flag.severity) ||
        redLineBySentence.has(flag.sourceSentence),
    ),
  );

  const redLineMatches = flags.flatMap((flag) => {
    const redLine = redLineBySentence.get(flag.sourceSentence);
    if (redLine === undefined) return [];
    return [{ flagId: flag.id, redLine, sourceSentence: flag.sourceSentence }];
  });

  return { flags, redLineMatches };
}
