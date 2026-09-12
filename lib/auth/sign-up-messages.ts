/**
 * What a reader is told when making an account does not work.
 *
 * Here rather than beside one form because two forms make accounts: the sign-up
 * page, and the one at the foot of a no-account result. A visitor who is told
 * "there is already an account on that address" in one place and something else
 * in the other is being told two things about the same fact.
 */

/** Supabase says what went wrong in its own words. This says it in the reader's. */
export function signUpProblem(reason: string): string {
  if (/already registered|already exists/i.test(reason)) {
    return 'There is already an account on that email address. Sign in instead.';
  }
  if (/rate limit|too many/i.test(reason)) {
    return 'That is a few attempts in a row. Wait a minute and try it again.';
  }
  return 'The account couldn’t be set up. Check the email address and try again.';
}
