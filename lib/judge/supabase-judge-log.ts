import type { SupabaseClient } from '@supabase/supabase-js';
import {
  agreementRateOf,
  JudgeLogError,
  type JudgeAgreementRate,
  type JudgeLogGateway,
  type JudgeReview,
} from './store';

export const JUDGE_LOG_TABLE = 'red_line_match_judgments';

const ROW_COLUMNS = 'id, red_line, source_sentence, fits, reasoning, created_at';

/**
 * The `red_line_match_judgments` table.
 *
 * A write names the reader whose run produced it, the way every other table
 * here does. A read names nobody: the audit ADR-0018 asks for is a rate across
 * readers, and the migration gives an authenticated session no select policy at
 * all, so `rate` returns rows only where it is called with a service role key.
 * A reader cannot read this log, which is the same thing as saying no screen
 * can show them what the judge said (ADR-0019).
 */
export function createSupabaseJudgeLog(
  supabase: SupabaseClient,
  ownerId: string,
): JudgeLogGateway {
  const table = () => supabase.from(JUDGE_LOG_TABLE);

  return {
    async record(review: JudgeReview): Promise<void> {
      const { error } = await table()
        .insert({
          owner_id: ownerId,
          red_line: review.redLine,
          source_sentence: review.sourceSentence,
          fits: review.fits,
          reasoning: review.reasoning,
        })
        .select(ROW_COLUMNS)
        .single();
      if (error) {
        throw new JudgeLogError(
          `The judge's review of a red line match was not logged: ${error.message}`,
        );
      }
    },

    async rate(): Promise<JudgeAgreementRate> {
      const { data, error } = await table()
        .select('fits, created_at')
        .order('created_at', { ascending: true });
      if (error) {
        throw new JudgeLogError(
          `The judge agreement rate could not be read: ${error.message}`,
        );
      }
      return agreementRateOf(
        (data ?? []).map((row) => ({ fits: (row as { fits: boolean }).fits })),
      );
    },
  };
}
