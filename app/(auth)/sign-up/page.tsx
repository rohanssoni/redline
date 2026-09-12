import Link from 'next/link';
import type { Metadata } from 'next';
import { isSupabaseConfigured, SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { signUp } from '../actions';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Set up an account — Redline' };

export default function SignUpPage() {
  const ready = isSupabaseConfigured();

  return (
    <div className="gate-sheet">
      <h1>Set up an account</h1>
      <p className="note">
        Redline keeps the text of the agreements you read, so you can come back to
        them. It never keeps the file.
      </p>
      {ready ? (
        <>
          <AuthForm
            action={signUp}
            submitLabel="Set up the account"
            pendingLabel="Setting it up"
            passwordHint="At least eight characters."
            autoComplete="new-password"
          />
          <p className="gate-swap">
            Already have one? <Link href="/sign-in">Sign in</Link>.
          </p>
        </>
      ) : (
        <div className="state" role="status">
          <p className="state-title">{SIGN_IN_UNAVAILABLE}</p>
        </div>
      )}
    </div>
  );
}
