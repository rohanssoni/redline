import {
  agreementRateOf,
  type JudgeAgreementRate,
  type JudgeLogGateway,
  type JudgeReview,
} from '../../lib/judge/store';

/**
 * A judge log that keeps its rows in memory. It stands in for the Supabase
 * table, which is one of the two things the suite is allowed to stub, so that
 * everything between the judge call and the row written is exercised for real.
 */
export interface StubJudgeLog extends JudgeLogGateway {
  /** Every review written, in order. */
  written: JudgeReview[];
  /** Makes the log refuse, the way a database that is down does. */
  fail(message: string): void;
}

export function createStubJudgeLog(): StubJudgeLog {
  const written: JudgeReview[] = [];
  let failure: string | null = null;

  return {
    written,
    fail(message: string) {
      failure = message;
    },
    async record(review: JudgeReview): Promise<void> {
      if (failure) throw new Error(failure);
      written.push(review);
    },
    async rate(): Promise<JudgeAgreementRate> {
      if (failure) throw new Error(failure);
      return agreementRateOf(written);
    },
  };
}
