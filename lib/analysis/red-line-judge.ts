/**
 * The judge on semantic red line matches (ADR-0018): a second model call, with
 * its own prompt, that reads the reader's red line and the document's sentence
 * and says whether the one really breaks the other.
 *
 * What it says changes nothing the reader sees (ADR-0019). This module cannot
 * change it: it is handed the matches *after* the override has already decided
 * what is shown, it returns reviews rather than flags, and nothing it returns is
 * read by `analyzeDocument` for anything other than the log. There is no branch
 * in here that could suppress a flag, reorder one, or mark one down, because
 * there is nothing in here holding a flag to begin with.
 *
 * A judge that cannot be reached, answers with the wrong shape, or throws for
 * any other reason leaves the flag exactly where it was. The flag is the
 * guarantee (ADR-0013); the judge is a signal about the matcher, and a signal
 * that failed to arrive is not evidence of anything.
 */

import type { ModelClient, StructuredRequest } from '../model/client';
import type { ObjectSchema } from '../model/json-schema';
import type { JudgeLogGateway, JudgeReview } from '../judge/store';
import type { RedLineMatch } from './red-line-override';

/** Names the judge call, in the model request and in the test that counts them. */
export const JUDGE_CALL_NAME = 'red_line_match_judgment';

/**
 * What the judge is asked for. Two fields and no third: there is no severity
 * here, no rewrite of the flag, and no place to put one, because a judgment that
 * could carry a correction would be a judgment something downstream was tempted
 * to apply.
 */
export const redLineJudgmentSchema: ObjectSchema = {
  type: 'object',
  properties: {
    fits: {
      type: 'boolean',
      description:
        'True when signing this sentence would cost the reader the thing their red line says they keep.',
    },
    reasoning: {
      type: 'string',
      description:
        'One or two sentences saying what the sentence does to the reader and why that does or does not break the red line.',
      minLength: 20,
    },
  },
  required: ['fits', 'reasoning'],
  additionalProperties: false,
};

interface JudgmentOutput {
  fits: boolean;
  reasoning: string;
}

const JUDGE_SYSTEM_PROMPT = [
  'A reader wrote down a term they will not accept. Something else read an agreement and picked out a sentence it says breaks that term. You decide whether that reading holds up.',
  '',
  'How to decide:',
  '- You are given the red line and the sentence, and nothing else. Judge those two against each other and nothing you imagine around them.',
  '- The sentence breaks the red line when signing it means giving up the thing the red line says the reader keeps.',
  '- The reader wrote their line in their own words and the agreement will not use them. Shared wording is not a match and different wording is not a miss.',
  '- Whether the clause is fair, common, or worth arguing about is not the question. The question is whether it costs the reader the thing they said they would not give up.',
  '',
  'Writing:',
  '- Say what you decided and why, in one or two sentences, naming what the sentence does to the reader.',
  '- Do not rewrite the sentence, do not rate it, and do not say what the reader should do about it.',
].join('\n');

/** The prompt for one match. Exported so a test can read what was sent. */
export function redLineJudgmentRequest(match: RedLineMatch): StructuredRequest {
  return {
    name: JUDGE_CALL_NAME,
    schema: redLineJudgmentSchema,
    messages: [
      { role: 'system', content: JUDGE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          'The reader will not accept this:',
          match.redLine,
          '',
          'This sentence from the agreement was picked out as breaking it:',
          match.sourceSentence,
        ].join('\n'),
      },
    ],
  };
}

export interface JudgeDeps {
  model: ModelClient;
  /** Where reviews are kept for audit. Absent where nothing is configured. */
  judgeLog?: JudgeLogGateway;
}

/**
 * Reviews every red line match, one call each, and writes what came back to the
 * log. Returns the reviews so a caller can count them; no caller does anything
 * else with them, and the reader-facing result never carries one.
 *
 * Never throws. Every failure — the model, the log, a reply of the wrong shape —
 * is a warning in the logs and nothing more, because the alternative is a second
 * model's outage deciding whether a reader's own stated red line reaches them.
 */
export async function reviewRedLineMatches(
  matches: readonly RedLineMatch[],
  deps: JudgeDeps,
): Promise<JudgeReview[]> {
  const reviews: JudgeReview[] = [];

  for (const match of matches) {
    let judgment: JudgmentOutput;
    try {
      judgment = await deps.model.complete<JudgmentOutput>(
        redLineJudgmentRequest(match),
      );
    } catch (error) {
      console.warn(
        'The judge did not review the red line match on %s, so there is nothing to log for it: %s',
        match.flagId,
        describe(error),
      );
      continue;
    }

    const review: JudgeReview = {
      redLine: match.redLine,
      sourceSentence: match.sourceSentence,
      fits: judgment.fits,
      reasoning: judgment.reasoning.trim(),
    };
    reviews.push(review);

    if (!review.fits) {
      console.warn(
        'The judge disagreed with a red line match. The flag stands (ADR-0019). Red line: %s | Sentence: %s | Reasoning: %s',
        review.redLine,
        review.sourceSentence,
        review.reasoning,
      );
    }

    if (!deps.judgeLog) continue;
    try {
      await deps.judgeLog.record(review);
    } catch (error) {
      console.warn(
        'A judge review of a red line match could not be logged: %s',
        describe(error),
      );
    }
  }

  return reviews;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
