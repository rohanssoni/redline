/**
 * The two limits on a try without an account, and the wording a refused visitor
 * reads.
 *
 * Both are here rather than at the route, because both have to be decided before
 * anything is sent to a model: the whole point of them is what an anonymous try
 * costs, and a limit checked after the call has already spent the money it was
 * meant to save.
 *
 * The numbers were chosen for this build and recorded on issue #19:
 *
 * - **Three tries per caller per UTC day.** A freelancer who hits a bad parse can
 *   try again and still read a second agreement before signing up, and an
 *   address that wants more than that is asking for more than a trial.
 * - **50,000 characters.** A client agreement runs roughly 1,000 to 4,000 words,
 *   so this clears a long one several times over while capping what a single
 *   anonymous request can cost. Nothing is inferred from the shape of the file:
 *   it is the extracted text that is measured, because the extracted text is
 *   what goes to the model.
 */

/** Tries one caller gets in a calendar day, UTC. */
export const ANONYMOUS_TRIES_PER_DAY = 3;

/** The longest extracted text a try without an account will read. */
export const MAXIMUM_DOCUMENT_CHARACTERS = 50_000;

/** The day a try counts against, as the rows record it. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Whether a caller who has already had `triesToday` may have another.
 *
 * Pure, and the whole of the daily rule. The count comes from a query and the
 * decision is made here, so the rule can be driven to either side of the limit
 * without a database.
 */
export function withinDailyLimit(triesToday: number): boolean {
  return triesToday < ANONYMOUS_TRIES_PER_DAY;
}

/** What a visitor who has used the day's tries reads. */
export const DAILY_LIMIT_REASON =
  'That’s the third read from this connection today, and three a day is what ' +
  'Redline gives without an account. The count starts again at midnight UTC. ' +
  'An account lifts it.';

/** What a visitor whose document is longer than the cap reads. */
export function tooLongReason(characters: number): string {
  return (
    `This one runs to about ${characters.toLocaleString('en-GB')} characters, and a ` +
    `read without an account stops at ${MAXIMUM_DOCUMENT_CHARACTERS.toLocaleString('en-GB')}, ` +
    'which is longer than most client agreements get. There’s nothing wrong with ' +
    'the file. It’s more than one free read covers.'
  );
}

/**
 * What a visitor reads when the count itself cannot be reached.
 *
 * This copy exists because the limiter fails closed on a configured project: see
 * `lib/anonymous/try-allowance.ts` for why, and for the one case that is not
 * treated as a failure.
 */
export const LIMIT_UNAVAILABLE_REASON =
  'Redline can’t reach the count it keeps of these free reads, and it won’t ' +
  'start a read it can’t count. Give it a few minutes and try again.';

/**
 * What an account adds, said once at the foot of a result.
 *
 * It states what is on the other side and stops. Nothing here asks twice, and
 * nothing here calls the result the visitor is holding incomplete: the summary
 * and the flags are the whole read, and the account buys the work that comes
 * after reading.
 */
export const WHAT_AN_ACCOUNT_ADDS = [
  'Redline drafts wording you can send back for each flag.',
  'You can ask questions and get answers from this document only.',
  'Your own red lines drive the read, so a term you never accept gets raised whatever it is called.',
  'Everything you read stays in a library you can go back to.',
];
