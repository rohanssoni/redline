'use server';

import { redirect } from 'next/navigation';
import { SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { serverSupabase } from '@/lib/supabase/server';

export interface AuthFormState {
  error?: string;
  notice?: string;
}

function credentials(formData: FormData): { email: string; password: string } {
  return {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  };
}

function missing(email: string, password: string): string | null {
  if (email.length === 0) return 'Enter the email address for your account.';
  if (password.length === 0) return 'Enter your password.';
  return null;
}

export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = credentials(formData);
  const gap = missing(email, password);
  if (gap) return { error: gap };

  const supabase = await serverSupabase();
  if (!supabase) return { error: SIGN_IN_UNAVAILABLE };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: 'That email address and password don’t match an account.' };
  }

  redirect('/documents/new');
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = credentials(formData);
  const gap = missing(email, password);
  if (gap) return { error: gap };
  if (password.length < 8) {
    return { error: 'Use a password of at least eight characters.' };
  }

  const supabase = await serverSupabase();
  if (!supabase) return { error: SIGN_IN_UNAVAILABLE };

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: signUpProblem(error.message) };
  }
  if (!data.session) {
    return {
      notice: `Check ${email} for a message from Redline. Opening the link in it confirms the address and signs you in.`,
    };
  }

  redirect('/documents/new');
}

/** Supabase says what went wrong in its own words. This says it in the reader's. */
function signUpProblem(reason: string): string {
  if (/already registered|already exists/i.test(reason)) {
    return 'There is already an account on that email address. Sign in instead.';
  }
  if (/rate limit|too many/i.test(reason)) {
    return 'That is a few attempts in a row. Wait a minute and try it again.';
  }
  return 'The account couldn’t be set up. Check the email address and try again.';
}

export async function signOut(): Promise<void> {
  const supabase = await serverSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect('/sign-in');
}
