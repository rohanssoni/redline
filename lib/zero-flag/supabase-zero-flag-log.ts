import type { SupabaseClient } from '@supabase/supabase-js';
import {
  toFinishedRead,
  zeroFlagRateOf,
  ZeroFlagRateError,
  type FinishedRead,
  type FinishedReadRow,
  type ZeroFlagLogGateway,
  type ZeroFlagRate,
} from './store';

export const ANALYSIS_READS_TABLE = 'analysis_reads';

const ROW_COLUMNS = 'id, clean_read, created_at';

/**
 * The `analysis_reads` table, for one reader.
 *
 * Writes only. A reader has no business seeing how often Redline finds nothing
 * across everybody's documents — it says nothing about their own agreement —
 * and the migration gives their session no select policy to see it with. The
 * rate lives in a schema no session has usage on.
 */
export function createSupabaseZeroFlagLog(
  supabase: SupabaseClient,
  ownerId: string,
): ZeroFlagLogGateway {
  return {
    async record(read: Pick<FinishedRead, 'cleanRead'>): Promise<void> {
      const { error } = await supabase
        .from(ANALYSIS_READS_TABLE)
        .insert({ owner_id: ownerId, clean_read: read.cleanRead })
        .select(ROW_COLUMNS)
        .single();
      if (error) {
        throw new ZeroFlagRateError(
          `That finished read was not counted: ${error.message}`,
        );
      }
    },
  };
}

/**
 * The zero-flag rate and the baseline in force, across every read Redline has
 * recorded.
 *
 * Named with no owner, like the dismissal rates and the copy counts: what is
 * being watched is the severity filter, not a person. Row level security is
 * what stops a reader running it — the query comes back empty for a signed-in
 * session, because the table is owner-scoped and has no select policy at all.
 * Whoever audits runs it with the service role, the way they run the matching
 * view in the migration.
 *
 * `now` is passed in rather than read here, so the switchover this reports can
 * be driven to either side of 90 days without waiting for them.
 */
export async function zeroFlagRate(
  supabase: SupabaseClient,
  now: Date,
): Promise<ZeroFlagRate> {
  const { data, error } = await supabase
    .from(ANALYSIS_READS_TABLE)
    .select('clean_read, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    throw new ZeroFlagRateError(
      `The zero-flag rate could not be read: ${error.message}`,
    );
  }

  return zeroFlagRateOf(
    (data ?? []).map((row) =>
      toFinishedRead(row as Pick<FinishedReadRow, 'clean_read' | 'created_at'>),
    ),
    now,
  );
}
