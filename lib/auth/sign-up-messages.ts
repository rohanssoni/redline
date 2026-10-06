/**
 * What a reader is told when making an account does not work.
 *
 * Here rather than beside one form because two forms make accounts: the sign-up
 * page, and the one at the foot of a no-account result. A visitor who is told
 * "there is already an account on that address" in one place and something else
 * in the other is being told two things about the same fact.
 */

export const PASSWORD_TOO_LONG =
  'That password is too long. Accented letters and emoji count as more than one character, so use fewer of them or a shorter password.';

/**
 * Supabase refuses a password over 72 bytes, and says "characters" when it
 * does. An accented letter is two bytes and an emoji four, so a password well
 * under 72 characters can still be refused. Counting bytes here catches it
 * before the request, with a reason the reader can act on.
 */
const PASSWORD_MAX_BYTES = 72;

/** Why a password chosen at sign-up won't be accepted, or null if it will. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use a password of at least eight characters.';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return PASSWORD_TOO_LONG;
  }
  return null;
}

/** Supabase says what went wrong in its own words. This says it in the reader's. */
export function signUpProblem(reason: string): string {
  if (/password cannot be longer/i.test(reason)) return PASSWORD_TOO_LONG;
  if (/already registered|already exists/i.test(reason)) {
    return 'There is already an account on that email address. Sign in instead.';
  }
  if (/rate limit|too many/i.test(reason)) {
    return 'That is a few attempts in a row. Wait a minute and try it again.';
  }
  return 'The account couldn’t be set up. Check the email address and try again.';
}
