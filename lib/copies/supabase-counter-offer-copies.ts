import type { SupabaseClient } from '@supabase/supabase-js';
import {
  copyCountsOf,
  CounterOfferCopyError,
  toCopiedCounterOffer,
  type CopiedCounterOffer,
  type CounterOfferCopiesGateway,
  type CounterOfferCopyCounts,
  type CounterOfferCopyRow,
} from './store';

export const COUNTER_OFFER_COPIES_TABLE = 'counter_offer_copies';

const ROW_COLUMNS = 'id, document_id, flag_id, stance, created_at';

/**
 * The `counter_offer_copies` table, for one reader.
 *
 * Writes only. A reader is never shown how many times they copied anything, so
 * there is no read here to be shown it with, and the migration gives their
 * session no way to select from the table either. The counts live in a schema
 * no session has usage on.
 */
export function createSupabaseCounterOfferCopies(
  supabase: SupabaseClient,
  ownerId: string,
): CounterOfferCopiesGateway {
  return {
    async record(copy: CopiedCounterOffer): Promise<void> {
      const { error } = await supabase
        .from(COUNTER_OFFER_COPIES_TABLE)
        .insert({
          owner_id: ownerId,
          document_id: copy.documentId,
          flag_id: copy.flagId,
          stance: copy.stance,
        })
        .select(ROW_COLUMNS)
        .single();
      if (error) {
        throw new CounterOfferCopyError(
          `That copy was not recorded: ${error.message}`,
        );
      }
    },
  };
}

/**
 * Counter-offers copied, soft and firm apart, across every read Redline has
 * stored.
 *
 * Named with no owner, like the dismissal rate: what is being watched is
 * whether the soft default is calibrated, not a person. Row level security is
 * what stops a reader running it — the query comes back empty for a signed-in
 * session, because the table is owner-scoped and has no select policy at all.
 * Whoever audits runs it with the service role, the way they run the matching
 * view in the migration.
 *
 * Both counts come out of the same rows, so they can never disagree about what
 * was copied — only about how much of it was the same draft twice.
 */
export async function counterOfferCopyCounts(
  supabase: SupabaseClient,
): Promise<CounterOfferCopyCounts> {
  const { data, error } = await supabase
    .from(COUNTER_OFFER_COPIES_TABLE)
    .select('document_id, flag_id, stance')
    .order('created_at', { ascending: true });
  if (error) {
    throw new CounterOfferCopyError(
      `The counter-offers readers copied could not be counted: ${error.message}`,
    );
  }

  const copies = (data ?? [])
    .map((row) =>
      toCopiedCounterOffer(
        row as Pick<CounterOfferCopyRow, 'document_id' | 'flag_id' | 'stance'>,
      ),
    )
    .filter((copy): copy is CopiedCounterOffer => copy !== null);

  return copyCountsOf(copies);
}
