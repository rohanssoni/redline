'use client';

import { useState } from 'react';
import { askAboutDocument } from './actions';

/** What is on screen under the box: an answer, a reason there is none, or nothing yet. */
type Asked =
  | { at: 'nothing' }
  | { at: 'asking' }
  | { at: 'answered'; question: string; answer: string }
  | { at: 'declined'; question: string; reason: string };

/**
 * The question box, docked at the foot of the reader's document.
 *
 * What comes back is either an answer built from this document or a reason
 * there is none, and both are shown the same way: under the question that was
 * asked, in the reader's own words, so the pair reads as a conversation about
 * the page above. A decline is marked as a decline and nothing more — it is the
 * product doing its job (ADR-0003, ADR-0014), so it gets no alarm, no warning
 * icon and no apology.
 *
 * Nothing is stored. The answer lives as long as the reader is on the page,
 * which is what the spec settles for v1.
 */
export function QuestionBox({ documentId }: { documentId: string }) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<Asked>({ at: 'nothing' });

  async function ask() {
    const wording = question.trim();
    if (wording.length === 0) return;

    setAsked({ at: 'asking' });
    const result = await askAboutDocument(documentId, wording);
    setAsked(
      result.answer
        ? { at: 'answered', question: wording, answer: result.answer }
        : {
            at: 'declined',
            question: wording,
            reason:
              result.reason ??
              'That question didn’t get through. Nothing about your document has changed, so try it again.',
          },
    );
  }

  return (
    <section className="ask" aria-labelledby="ask-heading">
      <p className="ask-label" id="ask-heading">
        Ask this document
      </p>
      <p className="ask-note">
        Answers come out of the text above and nowhere else. Where your agreement
        doesn’t cover something, Redline says so.
      </p>

      <form
        className="ask-form"
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <label className="visually-hidden" htmlFor="ask-field">
          Your question about this agreement
        </label>
        <textarea
          id="ask-field"
          rows={2}
          value={question}
          placeholder="What happens if they reject the work?"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void ask();
            }
          }}
        />
        <button
          className="link-button"
          type="submit"
          disabled={asked.at === 'asking' || question.trim().length === 0}
        >
          Ask
        </button>
      </form>

      {asked.at === 'asking' && (
        <p className="ask-state" role="status">
          Reading your agreement for the answer.
        </p>
      )}

      {(asked.at === 'answered' || asked.at === 'declined') && (
        <div className="ask-answer" role="status">
          <p className="ask-question">{asked.question}</p>
          {asked.at === 'answered' ? (
            <p className="ask-text">{asked.answer}</p>
          ) : (
            <p className="ask-text" data-tone="declined">
              {asked.reason}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
