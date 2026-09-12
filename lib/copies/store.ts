/**
 * Counter-offers copied, and the counts that come out of them.
 *
 * The primary success metric is a counter-offer **sent** (PRD, success
 * metrics). Redline cannot watch a message leave: the reader copies the wording
 * and pastes it into their own email, and the app never sees the send. So what
 * is recorded here is the copy, and a copy is what every name, column and
 * comment in this module says it is. Nothing reports a figure called "sent"
 * without saying it is copies, because the moment the proxy is read as a
 * confirmed send the metric is lying about something nobody can check.
 *
 * Two counts, always together, and the second is why the first can be trusted:
 *
 * - **Unique flag+stance.** A reader who copies one draft four times while
 *   fighting with their email client sent it once, so one flag in one stance
 *   counts once however many times it reached the clipboard.
 * - **Raw copies.** Every copy, repeats included. It is what makes that pattern
 *   visible rather than quietly folded away, and a gap between the two numbers
 *   is worth reading.
 *
 * Gaps are not in here and have no way in. A copy is looked up in
 * `AnalysisResult.counterOffers`, and a gap has no counter-offer and no way to
 * be given one (ADR-0014).
 */

import type { AnalysisResult, Stance } from '../analysis/types';

/** The two stances a reader can choose, as a set to check an untrusted one against. */
const STANCES: readonly Stance[] = ['soft', 'firm'];

/**
 * One counter-offer a reader copied: which document, which flag, and the stance
 * the wording was in.
 *
 * `stance` is read off the stored draft, never taken from the browser. The page
 * knows which stance is on screen, but a metric built on what a page reported
 * about itself is a metric nobody can audit, and the stored analysis holds the
 * same answer (ADR-0009, ADR-0012).
 */
export interface CopiedCounterOffer {
  documentId: string;
  flagId: string;
  stance: Stance;
}

/** The shape of a row in the `counter_offer_copies` table. */
export interface CounterOfferCopyRow {
  id: string;
  document_id: string;
  flag_id: string;
  stance: string;
  created_at: string;
}

/** How much of one stance was copied. */
export interface CopyCount {
  /**
   * Distinct flag+stance pairs copied. The nearest thing to a count of sends:
   * four copies of one draft are one of these.
   */
  uniqueCounterOffers: number;
  /** Every copy recorded, repeats included. */
  copies: number;
}

/**
 * Counter-offers copied, soft and firm apart, which is the split the stance
 * default is judged on (ADR-0009).
 *
 * There is no `sent` field and no total. Both would invite a reader of this
 * object to quote a number as confirmed sends, which is the one thing these
 * counts are not.
 */
export interface CounterOfferCopyCounts {
  soft: CopyCount;
  firm: CopyCount;
  /** What the counts are and are not, carried wherever they are reported. */
  note: string;
}

/** What the numbers mean, said wherever the numbers are shown. */
export const COPY_PROXY_NOTE =
  'These are copies rather than confirmed sends. Redline records a counter-offer when the reader copies it, and what happens next is out of its sight: whether the wording went into an email, and whether that email was sent. The unique flag and stance count is the closer stand-in for sends. The raw count beside it says how often drafts reached the clipboard, so a wide gap between the two usually means one draft was copied several times over.';

/** Raised when a copy cannot be recorded or the counts cannot be read. */
export class CounterOfferCopyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CounterOfferCopyError';
  }
}

/**
 * Recording that a counter-offer was copied. One reader's writes; the counts
 * are a figure across readers and are not in here, the same way the dismissal
 * rate is not in the dismissals gateway.
 */
export interface CounterOfferCopiesGateway {
  record(copy: CopiedCounterOffer): Promise<void>;
}

/** Enough of an analysis to say which counter-offers a reader could have copied. */
export type ReadCounterOffers = Pick<AnalysisResult, 'counterOffers'>;

/**
 * The counter-offer a copy names, as the stored read holds it, or `null` when
 * this read has no such draft.
 *
 * Every path into the table goes through here, which is what makes three things
 * facts about the code rather than rules to remember:
 *
 * - The stance recorded is the stored draft's own, so a browser reporting firm
 *   for a clause that only has a soft draft records nothing rather than
 *   inflating the firm count.
 * - A gap cannot be copied. It has no counter-offer, so the lookup fails.
 * - A flag from a read that has since been replaced records nothing either.
 */
export function copiedCounterOfferIn(
  documentId: string,
  analysis: ReadCounterOffers,
  flagId: string,
  stance: string,
): CopiedCounterOffer | null {
  const stored = analysis.counterOffers.find(
    (counterOffer) =>
      counterOffer.flagId === flagId && counterOffer.stance === stance,
  );
  if (!stored) return null;
  if (!STANCES.includes(stored.stance)) return null;

  return { documentId, flagId: stored.flagId, stance: stored.stance };
}

/**
 * The two counts, one stance at a time, over the copies recorded.
 *
 * A copy of a stance nobody can choose is dropped rather than counted into
 * either side. The column checks the same thing, and this is the second lock:
 * the counts are read by a person deciding whether the soft default is right,
 * and a third bucket smuggled into a row would sit in neither number while
 * still being a copy somebody made.
 */
export function copyCountsOf(
  copies: readonly CopiedCounterOffer[],
): CounterOfferCopyCounts {
  return {
    soft: countOf(copies, 'soft'),
    firm: countOf(copies, 'firm'),
    note: COPY_PROXY_NOTE,
  };
}

function countOf(
  copies: readonly CopiedCounterOffer[],
  stance: Stance,
): CopyCount {
  const ofStance = copies.filter((copy) => copy.stance === stance);
  return {
    uniqueCounterOffers: new Set(ofStance.map(keyOf)).size,
    copies: ofStance.length,
  };
}

/**
 * What "the same counter-offer" means: one flag of one document in one stance.
 * The document is in the key because a flag id belongs to the read it came from
 * and says nothing on its own.
 */
function keyOf(copy: CopiedCounterOffer): string {
  return `${copy.documentId} ${copy.flagId} ${copy.stance}`;
}

/** Turns a row into a copy, or `null` when the row holds a stance nobody can choose. */
export function toCopiedCounterOffer(
  row: Pick<CounterOfferCopyRow, 'document_id' | 'flag_id' | 'stance'>,
): CopiedCounterOffer | null {
  const stance = STANCES.find((each) => each === row.stance);
  if (!stance) return null;
  return {
    documentId: row.document_id,
    flagId: row.flag_id,
    stance,
  };
}
