/**
 * Which flags may hedge, and what the hedge says (ADR-0007, ADR-0010, ADR-0022).
 *
 * A hedge is only worth showing when the reader can check it. "This could allow
 * the client to move the bar after you have priced the job" is checkable when the
 * sentence genuinely reads two ways: the reader rereads the quoted sentence and
 * sees both readings. The same words attached to "a court might not enforce this"
 * are not checkable by anything in the document, so they are not shown at all.
 *
 * So hedging is decided here from two signals the model reports separately — the
 * sentence's own ambiguity, and how sure the reading is that the clause harms the
 * reader — and never from one blended score:
 *
 * 1. **Redline writes the hedge, the model does not.** A flag may hedge only when
 *    the model marked its sentence textually ambiguous *and* wrote out the two
 *    readings it is ambiguous between. The wording the reader sees is built from
 *    those two readings, so every hedge arrives with the thing that justifies it.
 *    A sentence marked ambiguous with no second reading behind it is worded
 *    plainly, because there is nothing for the reader to check.
 * 2. **Unverifiable hedging is struck out wherever it appears.** A sentence of
 *    explanation that hedges about anything other than the wording — how a court
 *    would rule, whether the clause is enforceable, what is probable — is removed
 *    before the reader sees it. That holds for an ambiguous flag as much as a
 *    plain one: being ambiguous licenses a hedge about the two readings, not a
 *    hedge about the outside world.
 *
 * `harmConfidence` reaches this module and changes nothing in it, which is the
 * point of ADR-0010: partial confidence in the harm still produces a plainly
 * worded flag (ADR-0006).
 */

import type { AmbiguousSentence } from './verified-flag';

/** A flag's wording as the model proposed it, before Redline settles it. */
export interface ProposedWording {
  /** What the model wrote for the reader. */
  explanation: string;
  /** The model's claim that the sentence's own wording carries two readings. */
  textualAmbiguity: boolean;
  /**
   * The two readings the model says the sentence is ambiguous between. Empty
   * where it claims no ambiguity — and the claim counts for nothing without them.
   */
  alternativeReadings: readonly string[];
}

/** The wording a reader may be shown, and what was taken out of it. */
export interface SettledWording {
  /** The explanation, with any unverifiable hedging removed. */
  explanation: string;
  /**
   * Whether the flag is hedged, which is now a fact about the wording below
   * rather than a claim the model made about the sentence.
   */
  textualAmbiguity: boolean;
  /** The hedge and the two readings behind it, or `null` for a plain flag. */
  ambiguity: AmbiguousSentence | null;
  /** The sentences struck out, for the log. The reader never sees these. */
  struck: string[];
}

/**
 * Hedging the reader has no way to check: uncertainty about courts, about
 * enforcement, about what is probable, about how the world will treat the clause.
 * None of it is answered by rereading the source sentence, which is the only
 * evidence the reader has.
 *
 * Hedging about the reading of the sentence itself is deliberately absent from
 * this list — that is the one hedge ADR-0010 allows, and Redline writes it here
 * rather than accepting the model's version of it.
 *
 * Consequences are not hedges. "A single claim could cost more than the fee" is a
 * statement about what the clause does if it fires, so it stays.
 */
const UNVERIFIABLE_HEDGE =
  /\b(?:a|the|any)\s+(?:court|judge|tribunal|arbitrator)\b|\b(?:may|might|could|would|probably|likely)\s+(?:not\s+)?(?:be\s+)?(?:enforce|enforced|enforceable|upheld|uphold|struck|invalid|void)\b|\benforceab(?:le|ility)\b|\b(?:arguably|possibly|perhaps|conceivably|presumably|potentially|probably|likely|in practice)\b|\bit(?:'s| is)\s+(?:unclear|uncertain|not\s+clear|hard\s+to\s+say)\b|\b(?:we|Redline)\s+(?:are|'re|is)\s+not\s+(?:sure|certain)\b|\b(?:seems|appears)\s+to\b|\bin\s+most\s+jurisdictions\b/i;

/** Whether a piece of wording hedges about something outside the document. */
export function hedgesUnverifiably(wording: string): boolean {
  return UNVERIFIABLE_HEDGE.test(wording);
}

/** The explanation broken into the sentences a reader reads it as. */
function sentencesOf(explanation: string): string[] {
  return explanation
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * The explanation with every unverifiable hedge taken out of it, sentence by
 * sentence, and the sentences that went.
 *
 * Whole sentences, because a hedge is a claim rather than a word: cutting "might"
 * out of "a court might not enforce this" would leave a flat assertion about a
 * court, which is worse than the hedge was.
 */
export function withoutUnverifiableHedging(explanation: string): {
  kept: string;
  struck: string[];
} {
  const kept: string[] = [];
  const struck: string[] = [];

  for (const sentence of sentencesOf(explanation)) {
    if (hedgesUnverifiably(sentence)) struck.push(sentence);
    else kept.push(sentence);
  }

  return { kept: kept.join(' '), struck };
}

/** The two readings, where the model actually supplied two usable ones. */
function twoReadings(
  alternativeReadings: readonly string[],
): [string, string] | null {
  const readings = alternativeReadings
    .map((reading) => reading.trim())
    .filter((reading) => reading.length > 0);

  if (readings.length !== 2) return null;
  if (readings[0] === readings[1]) return null;
  if (readings.some(hedgesUnverifiably)) return null;
  return [readings[0], readings[1]];
}

/** Ends a reading the way the reader will read it, as a finished sentence. */
function asSentence(reading: string): string {
  return /[.!?]$/.test(reading) ? reading : `${reading}.`;
}

/**
 * The hedged wording for a sentence that reads two ways, built from both of them.
 *
 * The hedge and its evidence are the same piece of text on purpose. A reader who
 * doubts the hedge has the two readings in front of them and the quoted sentence
 * above them, and can settle it without leaving the page.
 */
export function hedgeFor(readings: [string, string]): string {
  return [
    'This sentence could be read two ways.',
    `One reading: ${asSentence(readings[0])}`,
    `The other: ${asSentence(readings[1])}`,
  ].join(' ');
}

/**
 * The wording a flag may be shown with, or `null` when it may not be shown at all.
 *
 * `null` means every sentence of the explanation hedged about something outside
 * the document. What is left of a flag like that is a quoted sentence with no
 * reading attached, and a flag has to tell the reader what the sentence does.
 */
export function settleWording(proposed: ProposedWording): SettledWording | null {
  const { kept, struck } = withoutUnverifiableHedging(proposed.explanation);
  if (kept.length === 0) return null;

  const readings = proposed.textualAmbiguity
    ? twoReadings(proposed.alternativeReadings)
    : null;

  if (!readings) {
    return { explanation: kept, textualAmbiguity: false, ambiguity: null, struck };
  }

  return {
    explanation: kept,
    textualAmbiguity: true,
    ambiguity: { readings, hedge: hedgeFor(readings) },
    struck,
  };
}
