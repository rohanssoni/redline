/**
 * The counter-offer: replacement language drafted for one flagged clause, never
 * for a whole agreement (CONTEXT.md).
 *
 * Two lines run through this module, and neither is a convention anyone has to
 * remember:
 *
 * 1. **A gap can never be handed to `draftCounterOffer`** (ADR-0014). The
 *    parameter type is `ClauseToRewrite`, which is a `VerifiedFlag` — a type only
 *    `verifyFlags` can make — narrowed further by `statement?: never`, the field a
 *    `Gap` must carry. A gap fails on both counts, so `draftCounterOffer(gap,
 *    'soft', deps)` does not compile, anywhere, ever. There is no severity high
 *    enough, and no calling order, that gets a gap a drafted remedy.
 * 2. **A draft is kept only while it is anchored to the clause it rewrites**
 *    (ADR-0001, inherited). The model sends back the sentence it rewrote as its
 *    own field, and that sentence is checked against the flag's source sentence
 *    before anything is kept. A draft that wandered into a different clause is
 *    dropped outright rather than shown next to the wrong sentence.
 *
 * Only the soft stance exists after an analysis. The firm one is drafted on
 * demand, for one flag, when a reader asks for it (ADR-0009, ADR-0012):
 * `draftSoftCounterOffers` is the only thing this module runs over a whole read,
 * and it asks for soft and nothing else. A firm draft is made one at a time, by
 * `firmCounterOffer`, and it goes through the same anchoring check on the way —
 * a firm draft that wandered into another clause is dropped exactly as a soft
 * one is.
 */

import type { ModelClient, StructuredRequest } from '../model/client';
import type { ObjectSchema } from '../model/json-schema';
import { findSourceSentence } from './source-sentence';
import type { VerifiedFlag } from './verified-flag';

/** Names the drafting call, in the model request and in the test that counts them. */
export const COUNTER_OFFER_CALL_NAME = 'counter_offer';

/**
 * How hard a counter-offer pushes back, chosen by the reader for one flag and
 * defaulting to soft (CONTEXT.md: stance; ADR-0009).
 */
export type Stance = 'soft' | 'firm';

/**
 * What may be handed to `draftCounterOffer`: a flag that has been through the
 * source sentence check, and nothing carrying the field a gap is built around.
 *
 * Written as an intersection rather than as `VerifiedFlag` on its own because
 * both halves are doing work. The brand keeps out anything that has not quoted
 * the document. `statement?: never` keeps out a `Gap`, and keeps out any later
 * type that grows gap-shaped, however it was assembled (ADR-0014).
 */
export type ClauseToRewrite = VerifiedFlag & { statement?: never };

/** A counter-offer as the model sends it, before it has been anchored. */
export interface CounterOfferClaim {
  /** The flag this rewrites. */
  flagId: string;
  stance: Stance;
  /** The sentence it claims to rewrite. */
  sourceSentence: string;
  /** The replacement language for that one clause. */
  text: string;
}

// Not exported: naming this key is the only way to write a `CounterOffer`
// literal, and nothing outside this module can name it.
declare const anchoredToItsOwnClause: unique symbol;

/**
 * A counter-offer whose drafted language was checked against the source sentence
 * of the flag it belongs to. `AnalysisResult.counterOffers` accepts nothing else,
 * so a draft that rewrote some other clause has nowhere to go.
 */
export type CounterOffer = CounterOfferClaim & {
  readonly [anchoredToItsOwnClause]: true;
};

/** A draft that was dropped, and why. For the log, never for the reader. */
export interface DroppedCounterOffer {
  flagId: string;
  reason: string;
}

/**
 * What the model is asked for. `rewrites` exists so the draft can be checked
 * against the clause it was asked about: without it there would be nothing to
 * compare, and a draft about the wrong clause would read plausibly enough to
 * reach the reader.
 */
export const counterOfferSchema: ObjectSchema = {
  type: 'object',
  properties: {
    rewrites: {
      type: 'string',
      description:
        'The sentence you were asked to rewrite, copied back character for character. Never tidied, shortened, joined or repunctuated.',
      minLength: 20,
    },
    replacement: {
      type: 'string',
      description:
        'The replacement wording for that one sentence, ready to send back to the other side. No preamble, no explanation, no covering note.',
      minLength: 30,
    },
  },
  required: ['rewrites', 'replacement'],
  additionalProperties: false,
};

interface CounterOfferOutput {
  rewrites: string;
  replacement: string;
}

const DRAFTING_RULES = [
  'You rewrite one sentence of an agreement on behalf of the person being asked to sign it, so they have something to send back to the other side.',
  '',
  'What you are rewriting:',
  '- You are given one sentence from the agreement and what it costs the reader. Rewrite that sentence and nothing else.',
  '- The result is replacement wording for that one sentence, sitting where it sat. It is not a whole clause set, not a new agreement, and not a list of changes.',
  '- Write it as contract language in the register the sentence already uses, so it can be dropped into the document as it stands.',
  '',
  'What you may not do:',
  '- Do not ask for anything the agreement does not already deal with. If the sentence says nothing about payment timing, your rewrite says nothing about payment timing either.',
  '- Do not argue with terms that are not in the sentence, and do not mention other clauses.',
  '- Do not add a covering note, a greeting, a justification or a "happy to discuss". The reader writes their own message; you write the clause.',
  '- Do not say what a court would do or what the law requires.',
].join('\n');

/**
 * What each stance asks for, and the only thing that differs between the two
 * prompts. Firm asks for more than soft does; it is not licence to rewrite more
 * of the agreement, so every rule above still holds for it.
 */
const STANCE_RULES: Record<Stance, string[]> = {
  soft: [
    'The stance is soft. That means:',
    '- Ask for the smallest change that takes the harm out of the sentence, and leave the rest of it as the other side wrote it.',
    '- Where the other side has a real interest, keep it and bound it — a cap, a notice period, a right to decline — rather than striking it out.',
    '- Write it so someone can say yes without going back to their lawyer.',
  ],
  firm: [
    'The stance is firm. The reader has standing on this one clause and is willing to spend it. That means:',
    '- Ask for the version that leaves the reader whole, not the version that is easiest to agree to.',
    '- Where the sentence lets the other side act alone, require the reader’s agreement, or drop the power altogether.',
    '- Keep it a clause the other side could still sign. It is a firm ask, not a walk-out: no ultimatums, no deadlines, no threats, nothing about what happens if they refuse.',
  ],
};

/** What the model is told, for the one stance it is drafting in. */
function systemPromptFor(stance: Stance): string {
  return [DRAFTING_RULES, '', ...STANCE_RULES[stance], '',
    'Copy the sentence you were given into rewrites, character for character, so it can be checked against the agreement.',
  ].join('\n');
}

/** The prompt for one flag. Exported so a test can read what was sent. */
export function counterOfferRequest(
  flag: ClauseToRewrite,
  stance: Stance,
): StructuredRequest {
  return {
    name: COUNTER_OFFER_CALL_NAME,
    schema: counterOfferSchema,
    messages: [
      { role: 'system', content: systemPromptFor(stance) },
      {
        role: 'user',
        content: [
          `What this sentence costs the reader (${flag.clauseType}):`,
          flag.explanation,
          '',
          `Rewrite this sentence, in the ${stance} stance, and nothing else:`,
          flag.sourceSentence,
        ].join('\n'),
      },
    ],
  };
}

export interface CounterOfferDeps {
  model: ModelClient;
}

/**
 * Drafts the replacement language for one flagged clause, in one stance.
 *
 * The stance changes what is asked for and nothing else. Both go through the
 * same anchoring check below, because a firm draft that rewrote a different
 * clause is exactly as wrong as a soft one that did (ADR-0001).
 *
 * Returns `null` when what came back cannot be shown against this flag: a draft
 * that rewrote a different sentence, or one with nothing in it. A refused draft
 * is not repaired, not re-asked and not attached to the flag anyway — the flag
 * and its source sentence stand on their own, and a counter-offer pointing at the
 * wrong clause is worse than none.
 *
 * There is no gap branch in here, and no check for one, because the type makes
 * the call impossible rather than the body refusing it (ADR-0014).
 */
export async function draftCounterOffer(
  flag: ClauseToRewrite,
  stance: Stance,
  deps: CounterOfferDeps,
): Promise<CounterOffer | null> {
  const draft = await deps.model.complete<CounterOfferOutput>(
    counterOfferRequest(flag, stance),
  );

  const text = draft.replacement.trim();
  if (text.length === 0) {
    console.warn(
      'A counter-offer was dropped because it drafted nothing: %s',
      flag.id,
    );
    return null;
  }

  // The whole sentence, not part of one: `findSourceSentence` returns the span of
  // `flag.sourceSentence` that the reply quoted, so a draft that echoed a clause
  // from elsewhere, or half of this one, comes back as something other than the
  // sentence it was asked about.
  const anchor = findSourceSentence(flag.sourceSentence, draft.rewrites);
  if (anchor !== flag.sourceSentence) {
    console.warn(
      'A counter-offer was dropped because it rewrote a sentence other than the one it was asked about: %s (%s)',
      flag.id,
      draft.rewrites,
    );
    return null;
  }

  return {
    flagId: flag.id,
    stance,
    sourceSentence: flag.sourceSentence,
    text,
  } as CounterOffer;
}

/**
 * Drafts the soft counter-offer for every flag the reader will see, one call
 * each (ADR-0009: soft is the default, and the only stance drafted up front).
 *
 * A flag whose draft failed keeps its place, its severity and its source
 * sentence. The flag is what Redline guarantees; the draft is the convenience on
 * top of it, and a drafting model that is down does not take a reader's flags
 * away with it.
 */
export async function draftSoftCounterOffers(
  flags: readonly ClauseToRewrite[],
  deps: CounterOfferDeps,
): Promise<CounterOffer[]> {
  const drafted: CounterOffer[] = [];

  for (const flag of flags) {
    let counterOffer: CounterOffer | null;
    try {
      counterOffer = await draftCounterOffer(flag, 'soft', deps);
    } catch (error) {
      console.warn(
        'No counter-offer was drafted for %s, so the flag stands on its own: %s',
        flag.id,
        error instanceof Error ? error.message : String(error),
      );
      continue;
    }
    if (counterOffer) drafted.push(counterOffer);
  }

  return drafted;
}

/**
 * The counter-offers a stored row holds, checked again against the flags that
 * came back through `verifyFlags` on the way out of the store.
 *
 * The analysis column is jsonb, so a row is whatever was written into it. What
 * is refused here is what only the column could produce: a draft naming no flag
 * in this analysis, a draft whose sentence is not that flag's own sentence, a
 * second draft of a stance the flag already has, and a draft with nothing in it.
 * A row naming a gap fails the first of those, because a gap is never in
 * `flags`.
 *
 * A firm draft is kept. It is written to the row only after a reader asked for
 * it on one clause and it passed the same anchoring check as the soft one
 * (ADR-0012), and keeping it is what stops the next view of the document paying
 * for that draft again.
 */
export function verifyCounterOffers(
  claimed: readonly CounterOfferClaim[],
  flags: readonly ClauseToRewrite[],
): { counterOffers: CounterOffer[]; dropped: DroppedCounterOffer[] } {
  const sentences = new Map(flags.map((flag) => [flag.id, flag.sourceSentence]));
  const counterOffers: CounterOffer[] = [];
  const dropped: DroppedCounterOffer[] = [];
  const seen = new Set<string>();

  for (const claim of claimed) {
    const reason = refusalFor(claim, sentences, seen);
    if (reason !== null) {
      dropped.push({ flagId: claim.flagId, reason });
      continue;
    }

    seen.add(stanceKey(claim));
    counterOffers.push({
      flagId: claim.flagId,
      stance: claim.stance,
      sourceSentence: sentences.get(claim.flagId) as string,
      text: claim.text.trim(),
    } as CounterOffer);
  }

  return { counterOffers, dropped };
}

/**
 * One flag, one stance: what a draft is filed under, so a row holding two firm
 * drafts of the same clause shows the reader one of them rather than both.
 */
function stanceKey(claim: CounterOfferClaim): string {
  return `${claim.flagId}:${claim.stance}`;
}

/** Why this stored counter-offer cannot be shown, or `null` when it can. */
function refusalFor(
  claim: CounterOfferClaim,
  sentences: Map<string, string>,
  seen: Set<string>,
): string | null {
  const sentence = sentences.get(claim.flagId);
  if (sentence === undefined) {
    return 'it names no flag in this analysis';
  }
  if (claim.stance !== 'soft' && claim.stance !== 'firm') {
    return 'it is in no stance a reader can choose';
  }
  if (seen.has(stanceKey(claim))) {
    return `the flag already has a ${claim.stance} counter-offer`;
  }
  if (claim.sourceSentence !== sentence) {
    return 'it rewrites a sentence other than the one its flag quotes';
  }
  if (claim.text.trim().length === 0) {
    return 'it drafts nothing';
  }
  return null;
}
