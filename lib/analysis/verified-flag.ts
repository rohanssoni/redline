/**
 * The gate every flag passes through before a reader can see it (ADR-0001).
 *
 * A flag the model proposes is a `ProposedFlag`. A flag the reader may be shown
 * is a `VerifiedFlag`, and the only way to obtain one is `verifyFlags`, which
 * hands it back only when its source sentence was found in the document text.
 * `AnalysisResult.flags` accepts nothing else, so a flag without a showable
 * source sentence cannot reach the output: there is no order of calls that
 * produces one, because there is no other producer.
 */

import { findSourceSentence } from './source-sentence';

/** What a flag or gap costs the reader if it fires (CONTEXT.md: severity). */
export type SeverityBand = 'high' | 'medium' | 'low';

/** How sure the analysis is that the clause harms the reader (ADR-0006). */
export type HarmConfidence = 'full' | 'partial';

/**
 * A source sentence that reads two ways, and the hedged wording built from both
 * of them (ADR-0010, ADR-0022).
 *
 * The readings travel with the hedge rather than behind it, because the hedge is
 * only allowed to exist while the reader can check it. `settleWording` in
 * `hedging.ts` is the only thing that makes one.
 */
export interface AmbiguousSentence {
  /** The two readings the sentence's own wording leaves open. */
  readings: [string, string];
  /** What the reader is shown, built from those two readings. */
  hedge: string;
}

/** A clause capable of harming the reader, bound to its source sentence. */
export interface Flag {
  id: string;
  clauseType: string;
  /** Verbatim from the document text. */
  sourceSentence: string;
  severity: number;
  band: SeverityBand;
  explanation: string;
  /** True only where the sentence's own wording is open to two readings (ADR-0010). */
  textualAmbiguity: boolean;
  /**
   * The hedge and the two readings it rests on, where the flag is hedged, and
   * absent where it is plainly worded. Set only alongside `textualAmbiguity`:
   * a hedge with no readings under it is the thing ADR-0010 forbids.
   */
  ambiguity?: AmbiguousSentence;
  harmConfidence: HarmConfidence;
}

/**
 * A flag before its source sentence has been checked. Its `sourceSentence` is
 * whatever the model quoted, which may be wording that is nowhere in the
 * document.
 */
export interface ProposedFlag extends Flag {
  /**
   * Whether the clause lets the other side change the reader's economics on its
   * own, after the reader is committed (ADR-0004).
   */
  changesYourEconomicsUnilaterally: boolean;
  /** Whether the clause binds both sides in the same way (ADR-0004). */
  bindsBothSidesEqually: boolean;
}

// Not exported: naming this key is the only way to write a `VerifiedFlag`
// literal, and nothing outside this module can name it.
declare const checkedAgainstTheDocument: unique symbol;

/**
 * A flag whose source sentence was found in the document text, carrying that
 * document's own wording rather than the model's.
 */
export type VerifiedFlag = Flag & {
  readonly [checkedAgainstTheDocument]: true;
};

/** A flag that was dropped, and why. For the log, never for the reader. */
export interface DroppedFlag {
  id: string;
  /** The wording the model quoted, which the document does not contain. */
  quoted: string;
  reason: string;
}

// Not exported either, and for the same reason one step up: a `VerificationOutcome`
// is evidence that the flag stage ran to the end, so nothing outside this module
// may write one. `{ flags: [], dropped: [] }` is the shape a caller would reach
// for to claim "the flag stage found nothing" without having run it.
declare const theFlagStageRanToTheEnd: unique symbol;

/**
 * What the flag stage produced, and proof that it produced it. Only `verifyFlags`
 * can make one, so a caller holding a `VerificationOutcome` holds a flag stage
 * that finished rather than one that threw partway (ADR-0008).
 */
export type VerificationOutcome = {
  /** Every flag that may be shown. */
  flags: VerifiedFlag[];
  /** Every flag that may not, with the quote that failed. */
  dropped: DroppedFlag[];
} & { readonly [theFlagStageRanToTheEnd]: true };

/**
 * Keeps the flags whose quoted sentence is in `documentText`, rewritten to carry
 * the document's own wording, and drops the rest outright. A failed flag is not
 * repaired, not matched loosely, and not passed on without its sentence.
 */
export function verifyFlags(
  proposed: readonly Flag[],
  documentText: string,
): VerificationOutcome {
  const flags: VerifiedFlag[] = [];
  const dropped: DroppedFlag[] = [];

  for (const flag of proposed) {
    const sourceSentence = findSourceSentence(documentText, flag.sourceSentence);
    if (sourceSentence === null) {
      dropped.push({
        id: flag.id,
        quoted: flag.sourceSentence,
        reason: 'the quoted sentence is not in the document text',
      });
      continue;
    }

    flags.push({
      id: flag.id,
      clauseType: flag.clauseType,
      sourceSentence,
      severity: flag.severity,
      band: flag.band,
      explanation: flag.explanation,
      // Carried only where both signals agree. A flag claiming ambiguity with no
      // readings behind it goes on plainly worded, rather than hedging at the
      // reader with nothing they can check (ADR-0010).
      ...(flag.textualAmbiguity && flag.ambiguity
        ? { ambiguity: flag.ambiguity }
        : {}),
      textualAmbiguity: Boolean(flag.textualAmbiguity && flag.ambiguity),
      harmConfidence: flag.harmConfidence,
    } as VerifiedFlag);
  }

  return { flags, dropped } as VerificationOutcome;
}
