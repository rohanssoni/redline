/**
 * The question box: what this one document says, in answer to what the reader
 * asked, and nothing else.
 *
 * A seam of its own, called whenever a reader asks something and never from
 * `analyzeDocument`. Three things run through it:
 *
 * 1. **Grounded or silent.** An answer is built from the document text and
 *    nothing else. Where the text does not cover the question, Redline says so
 *    in its own words rather than passing on whatever the model reasoned its
 *    way to. The model reports whether the document addresses the question as
 *    its own field, separately from the answer, so "the document doesn't say"
 *    is a decision made here rather than a sentence the model chose to write.
 * 2. **Plain or nothing.** A flag may hedge, because the reader has the source
 *    sentence in front of them and can check the hedge against it (ADR-0010).
 *    An answer has no sentence of its own to lean on, so ADR-0007's
 *    plain-or-omit rule applies with nothing to license the other branch: a
 *    hedged sentence is struck by the same machinery that strikes one from a
 *    flag's reading, and an answer with nothing left is the document not saying.
 * 3. **A remedy question is declined, and a renewal read is not** (ADR-0003).
 *    The boundary is the question, not the document's age, so it cannot be
 *    drawn from anything Redline knows about the document. It is drawn from two
 *    signals the model reports about the question alone — whether it asks what
 *    to do about something that has already happened, and whether it asks for
 *    wording the document does not contain (ADR-0014) — and `scopeOf` below
 *    turns those into the decision. A question that asks what to agree to next
 *    time sets neither, which is why the same signed document answers a renewal
 *    read and declines a remedy question.
 */

import type { ModelClient, StructuredRequest } from '../model/client';
import type { ObjectSchema } from '../model/json-schema';
import {
  MINIMUM_READABLE_CHARACTERS,
  normalizeDocumentText,
  readableCharacterCount,
} from '../document-text';
import { withoutUnverifiableHedging } from './hedging';

/** Names the scope call, in the model request and in the test that reads it. */
export const QUESTION_SCOPE_CALL_NAME = 'question_scope';

/** Names the answering call, in the model request and in the test. */
export const DOCUMENT_ANSWER_CALL_NAME = 'document_answer';

/**
 * What came back for the reader: an answer built from the document, or a reason
 * there is none. There is no third case, and no shape that carries both.
 */
export type QuestionResult =
  | { answer: string }
  | { declined: true; reason: string };

export interface AnswerDeps {
  model: ModelClient;
}

/** What the reader is told when the document does not cover what they asked. */
export const DOCUMENT_DOESNT_SAY =
  'The document doesn’t say. Nothing in this agreement covers it, and Redline won’t fill in what the text leaves out.';

/**
 * What the reader is told when they asked a remedy question (ADR-0003).
 *
 * It says what Redline does and does not read for, and stops. Nothing here
 * suggests the reader asked the wrong thing, and nothing here is a view about
 * what they should do — that is the whole reason the question was declined.
 */
export const REMEDY_QUESTION_DECLINED =
  'Redline reads a document to help you decide what to sign, so it can’t tell you what to do about something already underway. Ask what this agreement says about it and you’ll get an answer.';

/**
 * What the reader is told when they asked for wording to fill a gap (ADR-0014).
 *
 * A gap has no sentence behind it, so there is nothing to rewrite and nothing
 * to check invented wording against. Saying that is more use to the reader than
 * a clause Redline made up.
 */
export const GAP_WORDING_DECLINED =
  'That term isn’t in the agreement, so there’s no sentence for Redline to work from and nothing you could check invented wording against. Where a clause is in the document, you get wording you could send back.';

/** What the reader is told when the box was sent empty. */
export const NO_QUESTION_ASKED =
  'Ask something about this agreement and Redline will answer from its text.';

/** What the reader is told when there is too little text to answer from. */
export const TOO_LITTLE_TEXT =
  'There isn’t enough text in this document to answer from.';

/**
 * The two things the model is asked about the question, and the two things it
 * is asked not to decide.
 *
 * Neither field is a verdict. Both are descriptions of what the reader asked
 * for, which is what makes the boundary something `scopeOf` draws rather than
 * something the model announces.
 */
export const questionScopeSchema: ObjectSchema = {
  type: 'object',
  properties: {
    asksWhatToDoNow: {
      type: 'boolean',
      description:
        'True when the question asks what the reader can do about something that has already happened under an agreement already in force: money not paid, work already rejected, notice already given, a dispute already underway. False when the question asks what the document says, or what the reader should agree to in an agreement they have not signed yet.',
    },
    asksForWordingNotInTheDocument: {
      type: 'boolean',
      description:
        'True when the question asks for wording the agreement does not contain: what a term that is absent should say, what to put in place of a missing clause, how to word something that is not in the text. False when the question is about wording that is in the document, including a question about changing it.',
    },
  },
  required: ['asksWhatToDoNow', 'asksForWordingNotInTheDocument'],
  additionalProperties: false,
};

/** What the model reports about the question, before Redline decides anything. */
export interface QuestionScope {
  asksWhatToDoNow: boolean;
  asksForWordingNotInTheDocument: boolean;
}

const SCOPE_SYSTEM_PROMPT = [
  'A reader has a contract in front of them and has asked a question about it. You describe what the question asks for. You do not answer it, and you do not decide what happens to it.',
  '',
  'Both answers are about the question only. Nothing about the document decides either of them: the same agreement, signed months ago, can be asked a question that is about what to do now and a question that is about what to agree to next time.',
  '',
  'asksWhatToDoNow:',
  '- True when the reader is asking what they can do about something that has already happened: an invoice unpaid, work already rejected, a deadline already missed, a dispute already running. The reader wants a course of action for a situation they are already in.',
  '- False when the reader is asking what the document says, what a clause means, or what they should agree to in an agreement they have not signed yet.',
  '- False for a question about a future agreement even where the reader mentions how the last one went. "What should I negotiate differently next time" is about the next signature, not about the last job, whatever prompted it.',
  '- Set it true only for what the question actually asks for. A question that describes a past event and then asks what the agreement says about it is asking about the document.',
  '',
  'asksForWordingNotInTheDocument:',
  '- True when the reader wants you to supply language the agreement does not contain: what a missing term should say, what to put where there is nothing, how to word a clause that is not in the text.',
  '- False when the question is about language that is in the document, including asking how a clause there could be changed.',
  '',
  'Neither signal is about how serious, how reasonable or how urgent the question is. Set both false where neither describes what was asked.',
].join('\n');

/** The prompt for the scope call. Exported so a test can read what was sent. */
export function questionScopeRequest(question: string): StructuredRequest {
  return {
    name: QUESTION_SCOPE_CALL_NAME,
    schema: questionScopeSchema,
    messages: [
      { role: 'system', content: SCOPE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Describe what this question asks for.\n\n---\n${question}\n---`,
      },
    ],
  };
}

/**
 * What the model is asked for in the answering stage.
 *
 * `addressedByTheDocument` is separate from `answer` on purpose. A model asked
 * for one string will fill it with something whatever the document holds, and a
 * plausible paragraph is exactly what an ungrounded answer looks like. Asked the
 * two questions apart, a model that has nothing to answer from says so in a
 * field, and Redline writes the sentence the reader sees.
 */
export const documentAnswerSchema: ObjectSchema = {
  type: 'object',
  properties: {
    addressedByTheDocument: {
      type: 'boolean',
      description:
        'True only when the text of the agreement answers the question. False when answering would need anything the document does not say.',
    },
    answer: {
      type: 'string',
      description:
        'What the agreement says in answer, in two to five plain sentences addressed to the reader as "you". Empty when addressedByTheDocument is false.',
    },
  },
  required: ['addressedByTheDocument', 'answer'],
  additionalProperties: false,
};

interface DocumentAnswerOutput {
  addressedByTheDocument: boolean;
  answer: string;
}

const ANSWER_SYSTEM_PROMPT = [
  'You answer a reader’s question about the agreement they have been given, using that agreement and nothing else.',
  '',
  'What you may use:',
  '- The text below. Not what agreements like it usually say, not what is standard in the trade, not what you know about the parties.',
  '- Where the agreement does not answer the question, set addressedByTheDocument to false and leave the answer empty. Do not reason toward a likely answer, and do not answer a nearby question instead.',
  '- A term the agreement is silent about is an answer in itself: say the agreement says nothing about it rather than filling it in.',
  '',
  'How to write:',
  '- Address the reader as "you" and the other side by the name the document uses.',
  '- Say it plainly. Do not hedge: no "possibly", no "arguably", no "this could be read as". If the document says it, say it; if it does not, say it does not.',
  '- Do not say what a court would do, what the law requires, whether a clause is enforceable, or what the reader should do about a dispute.',
  '- Do not quote long passages. Say what the agreement does in your own plain words.',
  '- Two to five sentences. No lists, no headings, no preamble.',
].join('\n');

/** The prompt for the answering call. Exported so a test can read what was sent. */
export function documentAnswerRequest(
  text: string,
  question: string,
): StructuredRequest {
  return {
    name: DOCUMENT_ANSWER_CALL_NAME,
    schema: documentAnswerSchema,
    messages: [
      { role: 'system', content: ANSWER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `The agreement:\n\n---\n${text}\n---\n\nThe reader asks:\n\n${question}`,
      },
    ],
  };
}

/**
 * Whether this question is one Redline answers, and what the reader is told
 * when it is not.
 *
 * The whole of ADR-0003's boundary is here, and it is a function of what the
 * question asks for rather than of anything about the document. A renewal read
 * sets neither signal — it asks what to agree to next time, which is a
 * prospective read of an agreement that happens to have been signed — so it
 * comes back answerable, from the same document that declines a remedy
 * question. Getting that second half right is as much the point as the first:
 * a question box that declines everything is no use to anyone.
 *
 * Exported because it is the rule, not an implementation detail, and a test
 * that wants to check both directions of the boundary should be able to reach
 * it without a model in the way.
 */
export function scopeOf(scope: QuestionScope): { reason: string } | null {
  if (scope.asksWhatToDoNow) return { reason: REMEDY_QUESTION_DECLINED };
  if (scope.asksForWordingNotInTheDocument) {
    return { reason: GAP_WORDING_DECLINED };
  }
  return null;
}

/**
 * Answers one question about one document, or declines it and says why.
 *
 * The scope call runs first and the answering call runs only if it comes back
 * answerable, so a remedy question is never put to a model that might answer
 * it. Nothing here reads the document's age, its analysis, or whether it has
 * been signed, because none of those is what the boundary is about.
 */
export async function answerQuestion(
  text: string,
  question: string,
  deps: AnswerDeps,
): Promise<QuestionResult> {
  const asked = question.trim();
  if (asked.length === 0) {
    return { declined: true, reason: NO_QUESTION_ASKED };
  }

  const documentText = normalizeDocumentText(text);
  if (readableCharacterCount(documentText) < MINIMUM_READABLE_CHARACTERS) {
    return { declined: true, reason: TOO_LITTLE_TEXT };
  }

  const scope = await deps.model.complete<QuestionScope>(
    questionScopeRequest(asked),
  );
  const declined = scopeOf(scope);
  if (declined) return { declined: true, reason: declined.reason };

  const reply = await deps.model.complete<DocumentAnswerOutput>(
    documentAnswerRequest(documentText, asked),
  );

  if (!reply.addressedByTheDocument) return { answer: DOCUMENT_DOESNT_SAY };

  // The same machinery that takes an uncheckable hedge out of a flag's reading
  // (ADR-0007, ADR-0022), with nothing here that can license one: a flag may
  // hedge about the two readings of its source sentence, and an answer has no
  // sentence of its own for a reader to reread.
  const { kept, struck } = withoutUnverifiableHedging(reply.answer.trim());
  for (const sentence of struck) {
    console.warn(
      'A hedge the reader could not have checked was taken out of an answer: %s',
      sentence,
    );
  }

  // Everything it had to say was hedged about something outside the document.
  // What is left is an answer the document does not support, which is what the
  // reader is told.
  if (kept.length === 0) return { answer: DOCUMENT_DOESNT_SAY };

  return { answer: kept };
}
