'use client';

import { useActionState } from 'react';
import type { AuthFormState } from './actions';

export interface AuthFormProps {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  pendingLabel: string;
  passwordHint?: string;
  autoComplete: 'current-password' | 'new-password';
}

export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  passwordHint,
  autoComplete,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={autoComplete}
          required
        />
        {passwordHint ? <p className="note">{passwordHint}</p> : null}
      </div>

      {state.error ? (
        <div className="state" data-tone="refused" role="alert">
          <p className="state-title">{state.error}</p>
        </div>
      ) : null}

      {state.notice ? (
        <div className="state" role="status">
          <p className="state-title">{state.notice}</p>
        </div>
      ) : null}

      <button className="action" type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
