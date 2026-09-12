'use server';

import { signUpProblem } from '@/lib/auth/sign-up-messages';
import { SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { serverSupabase } from '@/lib/supabase/server';

/**
 * Making an account from a no-account result, without leaving the page.
 *
 * The sign-up page redirects when it is done. This one cannot: the document is
 * in the tab and nowhere else, so a redirect between making the account and
 * writing the document down is the moment the document is lost. It answers
 * instead, and the form sends the text and the read on from there.
 */
export interface KeepAccountState {
  error?: string;
  /** Said when the account was made but there is no session to save with. */
  notice?: string;
  /** True once there is a session, so the tab can send what it is holding. */
  signedIn?: boolean;
}

export async function makeAccountToKeep(
  _previous: KeepAccountState,
  formData: FormData,
): Promise<KeepAccountState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (email.length === 0) return { error: 'Enter an email address.' };
  if (password.length === 0) return { error: 'Choose a password.' };
  if (password.length < 8) {
    return { error: 'Use a password of at least eight characters.' };
  }

  const supabase = await serverSupabase();
  if (!supabase) return { error: SIGN_IN_UNAVAILABLE };

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: signUpProblem(error.message) };

  // An account that needs its address confirmed has no session yet, and without
  // one there is nobody to save the document as. Saying so here is the honest
  // answer: the account is real, and this document is not going to survive the
  // trip to the inbox and back, because the tab holding it is the only copy.
  if (!data.session) {
    return {
      notice: `Your account is set up. Open the message Redline sent to ${email} to confirm the address and sign in. This read won’t come with you: it only exists in this tab, so read the file again once you’re in.`,
    };
  }

  return { signedIn: true };
}
