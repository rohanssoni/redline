import Link from 'next/link';
import type { Metadata } from 'next';
import { isSupabaseConfigured, SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { signIn } from '../actions';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Sign in — Redline' };

export default function SignInPage() {
  const ready = isSupabaseConfigured();

  return (
    <div className="gate-sheet">
      <h1>Sign in</h1>
      {ready ? (
        <>
          <AuthForm
            action={signIn}
            submitLabel="Sign in"
            pendingLabel="Signing you in"
            autoComplete="current-password"
          />
          <p className="gate-swap">
            No account yet? <Link href="/sign-up">Set one up</Link>.
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
