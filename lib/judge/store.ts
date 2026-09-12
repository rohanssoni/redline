/**
 * The judge log: what a second model said about each semantic red line match
 * (ADR-0018), kept for a later audit and for nothing else (ADR-0019).
 *
 * Nothing here is read on the way to a reader. A flag a red line put in front of
 * the reader looks the same whether the judge agreed with the match or not, so
 * this log is the whole of what the judge is for: someone reads it afterwards
 * and decides whether the matcher needs retuning.
 */

/**
 * What the judge said about one match: the reader's red line, the document's own
 * sentence, whether the judge thought the one breaks the other, and why.
 *
 * Every review is written, agreements included. A disagreement on its own is a
 * pile of complaints with no denominator, and the thing ADR-0018 asks to be
 * watched is a rate.
 */
export interface JudgeReview {
  /** The red line the match named, in the reader's own words. */
  redLine: string;
  /** The document's own sentence, as the flag carries it. */
  sourceSentence: string;
  /** Whether the judge thought the sentence really does break that red line. */
  fits: boolean;
  /** The judge's reasoning, in its own words. */
  reasoning: string;
}

/** The shape of a row in the judge log table. */
export interface JudgeReviewRow {
  id: string;
  red_line: string;
  source_sentence: string;
  fits: boolean;
  reasoning: string;
  created_at: string;
}

/**
 * What the judge has agreed and disagreed with, and how often.
 *
 * `note` travels with the numbers on purpose. ADR-0018 accepted a model judge
 * over a human-labeled set knowing it shares the blind spots of the model it
 * checks, so a disagreement rate is a reason to go and look, not a defect count.
 * Anywhere this is reported, that sentence is reported with it.
 */
export interface JudgeAgreementRate {
  reviewed: number;
  agreed: number;
  disagreed: number;
  /** A share of the reviews, 0 to 1, or `null` when nothing has been reviewed. */
  agreementRate: number | null;
  disagreementRate: number | null;
  note: string;
}

/** What the rate is worth, said wherever the rate is reported. */
export const JUDGE_SIGNAL_NOTE =
  'A second model checking the first. It shows where to look. Both models can miss the same thing, so neither agreement nor disagreement settles whether a match was right.';

/** Raised when the judge log cannot be written or read. */
export class JudgeLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JudgeLogError';
  }
}

/**
 * Everything the product does with the judge log: write a review, and count
 * what has been written. There is no read of a single row, because no screen
 * and no analysis has any business asking what the judge said about a flag.
 */
export interface JudgeLogGateway {
  record(review: JudgeReview): Promise<void>;
  rate(): Promise<JudgeAgreementRate>;
}

/**
 * The agreement and disagreement rates over a set of reviews.
 *
 * With nothing reviewed the two rates are `null` rather than 0 or 1. A run that
 * judged nothing has no rate, and reporting one as a number would be stating
 * something the rows do not say.
 */
export function agreementRateOf(
  reviews: readonly Pick<JudgeReview, 'fits'>[],
): JudgeAgreementRate {
  const reviewed = reviews.length;
  const agreed = reviews.filter((review) => review.fits).length;
  const disagreed = reviewed - agreed;

  return {
    reviewed,
    agreed,
    disagreed,
    agreementRate: reviewed === 0 ? null : agreed / reviewed,
    disagreementRate: reviewed === 0 ? null : disagreed / reviewed,
    note: JUDGE_SIGNAL_NOTE,
  };
}
