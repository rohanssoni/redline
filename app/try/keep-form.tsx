'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepThisTry } from '@/lib/anonymous/keep-request';
import type { AnonymousRead } from '@/lib/anonymous/try-document';
import { makeAccountToKeep, type KeepAccountState } from './actions';

/**
 * Making an account and keeping the read, in one place, on the page the read is
 * on.
 *
 * The text and the read are held here as props, in this tab, which is the whole
 * reason the form is here rather than on `/sign-up`: navigating away is how the
 * document gets lost, so the way to keep it cannot start with navigating away.
 *
 * No model is called by any of this. What goes up is the text and the read the
 * page is already showing, and the server writes them down as they arrive.
 */
type Saving =
  | { at: 'asking' }
  | { at: 'keeping' }
  | { at: 'failed'; reason: string };

export function KeepForm({
  name,
  text,
  read,
}: {
  name: string;
  text: string;
  read: AnonymousRead;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<KeepAccountState, FormData>(
    makeAccountToKeep,
    {},
  );
  const [saving, setSaving] = useState<Saving>({ at: 'asking' });
  const sent = useRef(false);

  useEffect(() => {
    if (!state.signedIn || sent.current) return;
    sent.current = true;
    setSaving({ at: 'keeping' });

    void keepThisTry({ name, text, read }).then((outcome) => {
      if (!outcome.kept) {
        // The account exists and this tab still has the document, so the reader
        // is told what happened and can send it again rather than losing it to
        // a failed write.
        sent.current = false;
        setSaving({ at: 'failed', reason: outcome.reason });
        return;
      }
      router.push(`/documents/${outcome.id}`);
    });
  }, [state.signedIn, name, text, read, router]);

  if (saving.at === 'keeping') {
    return (
      <div className="try-state" role="status">
        <p className="try-state-title">Putting {name} in your library</p>
        <p>
          The words and the read go across as they are. Redline isn’t reading it
          again.
        </p>
      </div>
    );
  }

  return (
    <form className="try-keep-form" action={formAction}>
      <div className="field">
        <label htmlFor="keep-email">Email</label>
        <input
          id="keep-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="keep-password">Password</label>
        <input
          id="keep-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <p className="note">Eight characters or more.</p>
      </div>

      {state.error ? (
        <div className="try-state" data-tone="refused" role="alert">
          <p className="try-state-title">{state.error}</p>
        </div>
      ) : null}

      {state.notice ? (
        <div className="try-state" role="status">
          <p className="try-state-title">{state.notice}</p>
        </div>
      ) : null}

      {saving.at === 'failed' ? (
        <div className="try-state" data-tone="refused" role="alert">
          <p className="try-state-title">This one didn’t get saved</p>
          <p>{saving.reason}</p>
        </div>
      ) : null}

      <button className="action" type="submit" disabled={pending}>
        {pending ? 'Setting it up' : 'Make an account and keep this'}
      </button>
    </form>
  );
}
