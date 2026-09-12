import { describe, expect, it, vi } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { createStubJudgeLog } from '../../tests/support/stub-judge-log';
import {
  agreeingJudgmentFor,
  createStubModelClient,
} from '../../tests/support/stub-model-client';
import { agreementRateOf, JUDGE_SIGNAL_NOTE } from '../judge/store';
import type { StructuredRequest } from '../model/client';
import type { RedLineMatch } from './red-line-override';
import {
  JUDGE_CALL_NAME,
  redLineJudgmentRequest,
  reviewRedLineMatches,
} from './red-line-judge';

/** The match this fixture plants: a clause only a red line puts on the page. */
function plantedMatch(): { match: RedLineMatch; explanation: string } {
  const { sidecar } = loadAdhesionFixture();
  const caught = sidecar.decoys.redLineOnly;
  expect(caught).toBeDefined();
  const planted = sidecar.flags.find(
    (flag) => flag.sourceSentence === caught?.sourceSentence,
  );
  expect(planted).toBeDefined();
  return {
    match: {
      flagId: planted!.id,
      redLine: caught!.redLine,
      sourceSentence: caught!.sourceSentence,
    },
    explanation: planted!.explanation,
  };
}

function disagreeing(reasoning: string) {
  return () => ({ fits: false, reasoning });
}

describe('what the judge is asked', () => {
  it('asks in a call of its own, about the red line and the sentence and nothing else', () => {
    const { match, explanation } = plantedMatch();

    const request = redLineJudgmentRequest(match);

    expect(request.name).toBe(JUDGE_CALL_NAME);
    expect(request.schema.required).toEqual(['fits', 'reasoning']);
    expect(request.schema.additionalProperties).toBe(false);

    const sent = request.messages.map((message) => message.content).join('\n');
    expect(sent).toContain(match.redLine);
    expect(sent).toContain(match.sourceSentence);
    // The matcher's own reading is kept out of it. A judge shown the argument it
    // is checking is agreeing with a summary, not reading the sentence.
    expect(sent).not.toContain(explanation);
  });

  it('has no field a verdict could carry a correction in', () => {
    const { match } = plantedMatch();

    const properties = Object.keys(
      redLineJudgmentRequest(match).schema.properties,
    );

    expect(properties.sort()).toEqual(['fits', 'reasoning']);
  });
});

describe('reviewing red line matches', () => {
  it('makes exactly one judge call for each match', async () => {
    const { match } = plantedMatch();
    const second: RedLineMatch = {
      flagId: 'another-flag',
      redLine: 'I will not work without a written deadline.',
      sourceSentence: match.sourceSentence,
    };
    const model = createStubModelClient({
      [JUDGE_CALL_NAME]: agreeingJudgmentFor,
    });

    await reviewRedLineMatches([match, second], { model });

    expect(model.calls.map((call) => call.name)).toEqual([
      JUDGE_CALL_NAME,
      JUDGE_CALL_NAME,
    ]);
    const asked = model.calls.map((call) =>
      call.messages.map((message) => message.content).join('\n'),
    );
    expect(asked[0]).toContain(match.redLine);
    expect(asked[1]).toContain(second.redLine);
  });

  it('writes a disagreement to the log with the red line, the sentence and the reasoning', async () => {
    const { match } = plantedMatch();
    const reasoning =
      'The sentence restricts where the work may be published, which is not the payment term the reader ruled out.';
    const model = createStubModelClient({
      [JUDGE_CALL_NAME]: disagreeing(reasoning),
    });
    const judgeLog = createStubJudgeLog();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await reviewRedLineMatches([match], { model, judgeLog });

    expect(judgeLog.written).toEqual([
      {
        redLine: match.redLine,
        sourceSentence: match.sourceSentence,
        fits: false,
        reasoning,
      },
    ]);
    warn.mockRestore();
  });

  it('writes agreements too, so the rate has both sides of the ratio', async () => {
    const { match } = plantedMatch();
    const model = createStubModelClient({
      [JUDGE_CALL_NAME]: agreeingJudgmentFor,
    });
    const judgeLog = createStubJudgeLog();

    await reviewRedLineMatches([match, match], { model, judgeLog });

    expect(judgeLog.written).toHaveLength(2);
    expect(judgeLog.written.every((review) => review.fits)).toBe(true);
    expect(await judgeLog.rate()).toMatchObject({
      reviewed: 2,
      agreed: 2,
      disagreed: 0,
      agreementRate: 1,
      disagreementRate: 0,
    });
  });

  it('logs nothing and carries on when the judge call throws', async () => {
    const { match } = plantedMatch();
    const model = createStubModelClient({
      [JUDGE_CALL_NAME]: agreeingJudgmentFor,
    });
    model.fail(JUDGE_CALL_NAME, 'OpenRouter is unreachable');
    const judgeLog = createStubJudgeLog();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reviews = await reviewRedLineMatches([match], { model, judgeLog });

    expect(reviews).toEqual([]);
    expect(judgeLog.written).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps judging the rest when one call throws', async () => {
    const { match } = plantedMatch();
    const model = createStubModelClient({});
    let asked = 0;
    model.reply(JUDGE_CALL_NAME, (request: StructuredRequest) => {
      asked += 1;
      if (asked === 1) throw new Error('OpenRouter is unreachable');
      return agreeingJudgmentFor(request);
    });
    const judgeLog = createStubJudgeLog();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reviews = await reviewRedLineMatches([match, match], {
      model,
      judgeLog,
    });

    expect(reviews).toHaveLength(1);
    expect(judgeLog.written).toHaveLength(1);
    warn.mockRestore();
  });

  it('does not throw when the log itself refuses the write', async () => {
    const { match } = plantedMatch();
    const model = createStubModelClient({
      [JUDGE_CALL_NAME]: agreeingJudgmentFor,
    });
    const judgeLog = createStubJudgeLog();
    judgeLog.fail('new row violates row-level security policy');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reviews = await reviewRedLineMatches([match], { model, judgeLog });

    expect(reviews).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('judges nothing when no red line caught anything', async () => {
    const model = createStubModelClient({
      [JUDGE_CALL_NAME]: agreeingJudgmentFor,
    });

    const reviews = await reviewRedLineMatches([], { model });

    expect(reviews).toEqual([]);
    expect(model.calls).toEqual([]);
  });

  it('refuses a verdict that is not the shape the schema asked for, and logs none of it', async () => {
    const { match } = plantedMatch();
    const model = createStubModelClient({
      [JUDGE_CALL_NAME]: { fits: 'probably', reasoning: 17 },
    });
    const judgeLog = createStubJudgeLog();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reviews = await reviewRedLineMatches([match], { model, judgeLog });

    expect(reviews).toEqual([]);
    expect(judgeLog.written).toEqual([]);
    warn.mockRestore();
  });
});

describe('the rate the audit reads', () => {
  it('counts agreements and disagreements as shares of what was reviewed', () => {
    const rate = agreementRateOf([
      { fits: true },
      { fits: true },
      { fits: false },
      { fits: true },
    ]);

    expect(rate.reviewed).toBe(4);
    expect(rate.agreed).toBe(3);
    expect(rate.disagreed).toBe(1);
    expect(rate.agreementRate).toBeCloseTo(0.75);
    expect(rate.disagreementRate).toBeCloseTo(0.25);
  });

  it('reports no rate at all when nothing has been reviewed', () => {
    const rate = agreementRateOf([]);

    expect(rate).toMatchObject({
      reviewed: 0,
      agreed: 0,
      disagreed: 0,
      agreementRate: null,
      disagreementRate: null,
    });
  });

  it('carries what the number is worth wherever it is reported', () => {
    expect(agreementRateOf([{ fits: false }]).note).toBe(JUDGE_SIGNAL_NOTE);
    expect(JUDGE_SIGNAL_NOTE).toMatch(/where to look/i);
  });
});
