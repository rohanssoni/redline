'use client';

import { useActionState, useId, useState } from 'react';
import type { RedLine } from '@/lib/red-lines/store';
import { RED_LINE_MAX_LENGTH } from '@/lib/red-lines/store';
import {
  addRedLine,
  editRedLine,
  removeRedLine,
  type RedLineFormState,
} from './actions';

/**
 * The reader's red lines, written and rewritten in their own words. The list is
 * the reader's, not a document's, which is why it has a screen of its own rather
 * than a panel beside a result.
 */
export function RedLinesEditor({ redLines }: { redLines: RedLine[] }) {
  return (
    <>
      <AddRedLine empty={redLines.length === 0} />

      {redLines.length > 0 ? (
        <ul className="red-lines">
          {redLines.map((redLine) => (
            <li key={redLine.id}>
              <RedLineItem redLine={redLine} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function AddRedLine({ empty }: { empty: boolean }) {
  const [state, formAction, pending] = useActionState<RedLineFormState, FormData>(
    addRedLine,
    {},
  );
  const fieldId = useId();

  return (
    <form className="red-line-add" action={formAction}>
      <div className="field">
        <label htmlFor={fieldId}>
          {empty ? 'Write your first red line' : 'Add another red line'}
        </label>
        <textarea
          id={fieldId}
          name="text"
          rows={2}
          maxLength={RED_LINE_MAX_LENGTH}
          placeholder="I won’t take equity, credit or exposure instead of money."
          required
        />
      </div>

      {state.error ? (
        <div className="state" data-tone="refused" role="alert">
          <p className="state-title">{state.error}</p>
        </div>
      ) : null}

      <button className="action action-compact" type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add to my list'}
      </button>
    </form>
  );
}

function RedLineItem({ redLine }: { redLine: RedLine }) {
  const [text, setText] = useState(redLine.text);
  const [editState, editAction, editing] = useActionState<
    RedLineFormState,
    FormData
  >(editRedLine, {});
  const [removeState, removeAction, removing] = useActionState<
    RedLineFormState,
    FormData
  >(removeRedLine, {});
  const fieldId = useId();
  const changed = text.trim() !== redLine.text;
  const problem = editState.error ?? removeState.error;

  return (
    <div className="red-line">
      <form className="red-line-body" action={editAction}>
        <input type="hidden" name="id" value={redLine.id} />
        <label className="red-line-label" htmlFor={fieldId}>
          Red line
        </label>
        <textarea
          id={fieldId}
          name="text"
          rows={2}
          maxLength={RED_LINE_MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
        />
        <button
          className="link-button"
          type="submit"
          disabled={editing || !changed}
        >
          {editing ? 'Saving…' : 'Save this wording'}
        </button>
      </form>

      <form action={removeAction}>
        <input type="hidden" name="id" value={redLine.id} />
        <button className="link-button" type="submit" disabled={removing}>
          {removing ? 'Removing…' : 'Remove'}
        </button>
      </form>

      {problem ? (
        <div className="state" data-tone="refused" role="alert">
          <p className="state-title">{problem}</p>
        </div>
      ) : null}
    </div>
  );
}
