import { describe, expect, it, vi } from 'vitest';
import { loadAdhesionFixture, type FixtureQuestion } from '../../tests/fixtures';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import {
  DOCUMENT_ANSWER_CALL_NAME,
  DOCUMENT_DOESNT_SAY,
  GAP_WORDING_DECLINED,
  NO_QUESTION_ASKED,
  QUESTION_SCOPE_CALL_NAME,
  REMEDY_QUESTION_DECLINED,
  answerQuestion,
  scopeOf,
  type QuestionResult,
} from './answer-question';
import { hedgesUnverifiably } from './hedging';

/** The question the sidecar planted under this name. */
function plantedQuestion(id: string): FixtureQuestion {
  const { sidecar } = loadAdhesionFixture();
  const question = (sidecar.questions ?? []).find((each) => each.id === id);
  if (!question) throw new Error(`The adhesion fixture has no ${id} question.`);
  return question;
}

/** Asks the adhesion fixture one of its planted questions, for real. */
async function ask(id: string): Promise<{
  result: QuestionResult;
  question: FixtureQuestion;
  model: ReturnType<typeof stubModelClientFor>;
}> {
  const { text, sidecar } = loadAdhesionFixture();
  const model = stubModelClientFor(sidecar);
  const question = plantedQuestion(id);
  const result = await answerQuestion(text, question.question, { model });
  return { result, question, model };
}

function answerOf(result: QuestionResult): string {
  if ('declined' in result) {
    throw new Error(`Expected an answer, got a decline: ${result.reason}`);
  }
  return result.answer;
}

function reasonOf(result: QuestionResult): string {
  if (!('declined' in result)) {
    throw new Error(`Expected a decline, got an answer: ${result.answer}`);
  }
  return result.reason;
}

describe('answering a question from the document', () => {
  it('answers a question the agreement covers, in its own plain words', async () => {
    const { result, question, model } = await ask('scope-changes');

    expect(answerOf(result)).toBe(question.answer);
    expect(model.calls.map((call) => call.name)).toEqual([
      QUESTION_SCOPE_CALL_NAME,
      DOCUMENT_ANSWER_CALL_NAME,
    ]);
  });

  it('puts the document and the reader’s own words to the answering model', async () => {
    const { text } = loadAdhesionFixture();
    const { model, question } = await ask('scope-changes');

    const asked = model.calls
      .find((call) => call.name === DOCUMENT_ANSWER_CALL_NAME)!
      .messages.map((message) => message.content)
      .join('\n');

    expect(asked).toContain(question.question);
    expect(asked).toContain('Client may modify, add to, or otherwise revise');
    expect(asked).toContain(text.trim().split('\n')[0]);
  });

  it('says the document doesn’t say, rather than reasoning toward a guess', async () => {
    const { result, model } = await ask('not-covered');

    expect(answerOf(result)).toBe(DOCUMENT_DOESNT_SAY);
    expect(answerOf(result)).toMatch(/doesn’t say/);
    // Printing is genuinely absent from the fixture, so an answer naming a
    // price, a party or a section would be something the model worked out.
    expect(answerOf(result)).not.toMatch(/Halverson|Exhibit A|Section/);
  });

  it('asks nothing of the model when the box was sent empty', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    const result = await answerQuestion(text, '   ', { model });

    expect(reasonOf(result)).toBe(NO_QUESTION_ASKED);
    expect(model.calls).toHaveLength(0);
  });
});

describe('the boundary between a remedy question and a renewal read', () => {
  it('declines a remedy question on this document, and says why', async () => {
    const { result, model } = await ask('late-payment-remedy');

    expect(reasonOf(result)).toBe(REMEDY_QUESTION_DECLINED);
    // Never answered: the answering model is not even asked, so there is no
    // answer anywhere for a later change to leak to the reader.
    expect(model.calls.map((call) => call.name)).toEqual([
      QUESTION_SCOPE_CALL_NAME,
    ]);
  });

  it('answers a renewal read on the same signed document', async () => {
    const { result, question } = await ask('renewal-read');

    expect(answerOf(result)).toBe(question.answer);
    expect(answerOf(result)).toContain('Halverson');
  });

  it('turns on what the question asks for, not on the document’s age', () => {
    const remedy = plantedQuestion('late-payment-remedy');
    const renewal = plantedQuestion('renewal-read');

    // Both were asked of one agreement the reader has already signed. The
    // fixture says so in both questions, and only the first is declined.
    expect(renewal.question).toContain('already signed');
    expect(scopeOf(remedy)).toEqual({ reason: REMEDY_QUESTION_DECLINED });
    expect(scopeOf(renewal)).toBeNull();
  });

  it('declines a request for wording to fill a gap, and says why', async () => {
    const { result, model } = await ask('gap-wording');

    expect(reasonOf(result)).toBe(GAP_WORDING_DECLINED);
    expect(model.calls.map((call) => call.name)).toEqual([
      QUESTION_SCOPE_CALL_NAME,
    ]);
  });

  it('declines a question that asks what to do now even where it also wants wording', () => {
    expect(
      scopeOf({ asksWhatToDoNow: true, asksForWordingNotInTheDocument: true }),
    ).toEqual({ reason: REMEDY_QUESTION_DECLINED });
  });

  it('answers a question that asks for neither', () => {
    expect(
      scopeOf({ asksWhatToDoNow: false, asksForWordingNotInTheDocument: false }),
    ).toBeNull();
  });
});

describe('what an answer is allowed to say', () => {
  it('contains no hedged wording, in any answer this document produces', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const answerable = (sidecar.questions ?? []).filter(
      (question) => !question.asksWhatToDoNow && !question.asksForWordingNotInTheDocument,
    );
    expect(answerable.length).toBeGreaterThan(1);

    for (const question of answerable) {
      const result = await answerQuestion(text, question.question, {
        model: stubModelClientFor(sidecar),
      });
      expect(hedgesUnverifiably(answerOf(result))).toBe(false);
    }
  });

  it('strikes a hedge the reader has no way to check out of what it shows', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    const question = plantedQuestion('scope-changes');
    model.reply(DOCUMENT_ANSWER_CALL_NAME, {
      addressedByTheDocument: true,
      answer:
        'Halverson can revise the deliverables at any time and the Fee stays the same. A court would probably not enforce a clause that one-sided.',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await answerQuestion(text, question.question, { model });

    expect(answerOf(result)).toBe(
      'Halverson can revise the deliverables at any time and the Fee stays the same.',
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('says the document doesn’t say when every sentence hedged', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    const question = plantedQuestion('scope-changes');
    model.reply(DOCUMENT_ANSWER_CALL_NAME, {
      addressedByTheDocument: true,
      answer:
        'This could possibly mean the Fee changes. A court might not enforce it either way.',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await answerQuestion(text, question.question, { model });

    expect(answerOf(result)).toBe(DOCUMENT_DOESNT_SAY);
    warn.mockRestore();
  });
});

describe('the decline wording the reader reads', () => {
  const declines = [REMEDY_QUESTION_DECLINED, GAP_WORDING_DECLINED];

  it('says what Redline does rather than what the reader did', () => {
    for (const reason of declines) {
      expect(reason.length).toBeGreaterThan(40);
      expect(reason).not.toMatch(/sorry|apolog|unfortunately|I can’t|cannot help/i);
      expect(reason).not.toMatch(
        /inappropriate|not allowed|shouldn’t be asking|improper/i,
      );
    }
  });

  it('reads as nothing like legal advice', () => {
    for (const reason of declines) {
      expect(reason).not.toMatch(
        /\b(?:sue|claim|court|lawsuit|damages|breach of contract|your rights|legally|entitled)\b/i,
      );
      expect(hedgesUnverifiably(reason)).toBe(false);
    }
  });
});

describe('a document with too little text in it', () => {
  it('declines rather than putting an empty page to the model', async () => {
    const { sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    const result = await answerQuestion('Short.', 'What does this say?', {
      model,
    });

    expect(reasonOf(result)).toMatch(/isn’t enough text/);
    expect(model.calls).toHaveLength(0);
  });
});
