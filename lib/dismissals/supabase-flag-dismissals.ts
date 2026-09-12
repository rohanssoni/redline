import type { SupabaseClient } from '@supabase/supabase-js';
import { toStoredDocument, type DocumentRow } from '../documents/store';
import { DOCUMENTS_TABLE } from '../documents/supabase-documents';
import {
  dismissalRatesOf,
  FlagDismissalError,
  shownFlagsOf,
  toDismissedFlag,
  type DismissedFlag,
  type FlagDismissalRow,
  type FlagDismissalsGateway,
  type FlagDismissalRates,
  type ShownFlag,
} from './store';

export const FLAG_DISMISSALS_TABLE = 'flag_dismissals';

const ROW_COLUMNS = 'id, document_id, flag_id, red_line_triggered, created_at';
const DOCUMENT_COLUMNS =
  'id, name, extracted_text, analysis, created_at, updated_at';

/**
 * The `flag_dismissals` table, for one reader.
 *
 * Every query names the owner as well as the document, so a bug in a caller
 * cannot widen what comes back before row level security refuses it. The reader
 * can read and delete their own rows, because they are shown which flags they
 * set aside and can bring any of them back. What they cannot reach is the rate:
 * the migration keeps that in a schema no session has usage on.
 */
export function createSupabaseFlagDismissals(
  supabase: SupabaseClient,
  ownerId: string,
): FlagDismissalsGateway {
  const table = () => supabase.from(FLAG_DISMISSALS_TABLE);

  return {
    async dismiss(flag: ShownFlag): Promise<void> {
      const { error } = await table()
        .insert({
          owner_id: ownerId,
          document_id: flag.documentId,
          flag_id: flag.flagId,
          red_line_triggered: flag.redLineTriggered,
        })
        .select(ROW_COLUMNS)
        .single();
      if (error) {
        throw new FlagDismissalError(
          `That flag was not set aside: ${error.message}`,
        );
      }
    },

    async restore(documentId: string, flagId: string): Promise<boolean> {
      const { data, error } = await table()
        .delete()
        .eq('document_id', documentId)
        .eq('flag_id', flagId)
        .eq('owner_id', ownerId)
        .select('id')
        .maybeSingle();
      if (error) {
        throw new FlagDismissalError(
          `That flag was not brought back: ${error.message}`,
        );
      }
      return data !== null;
    },

    async forDocument(documentId: string): Promise<DismissedFlag[]> {
      const { data, error } = await table()
        .select(ROW_COLUMNS)
        .eq('document_id', documentId)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true });
      if (error) {
        throw new FlagDismissalError(
          `The flags you set aside could not be read: ${error.message}`,
        );
      }
      return (data ?? []).map((row) => toDismissedFlag(row as FlagDismissalRow));
    },
  };
}

/**
 * The dismissal rate for ordinary flags and for red-line-triggered flags,
 * across every read Redline has stored.
 *
 * Named with no owner, for the same reason the judge's rate is: what is being
 * watched is the threshold and the matcher, not a person. Row level security is
 * what stops a reader running this — both queries below come back empty for a
 * signed-in session, because `documents` is owner-scoped and so is
 * `flag_dismissals`. Whoever audits runs it with the service role, the way they
 * run the equivalent view in the migration.
 *
 * The denominator is built by putting every stored analysis back through the
 * same gates a reader's view of it goes through, so a flag that would be dropped
 * on the way to a screen — one that no longer quotes its document (ADR-0001) —
 * is not counted as a flag anyone was shown. Only `flags` is read. Gaps are in
 * a different list, and nothing here looks at it.
 */
export async function flagDismissalRates(
  supabase: SupabaseClient,
): Promise<FlagDismissalRates> {
  const documents = await supabase
    .from(DOCUMENTS_TABLE)
    .select(DOCUMENT_COLUMNS)
    .order('created_at', { ascending: true });
  if (documents.error) {
    throw new FlagDismissalError(
      `The flags readers were shown could not be counted: ${documents.error.message}`,
    );
  }

  const shown: ShownFlag[] = (documents.data ?? []).flatMap((row) => {
    const document = toStoredDocument(row as DocumentRow);
    return document.analysis
      ? shownFlagsOf(document.id, document.analysis)
      : [];
  });

  const dismissals = await supabase
    .from(FLAG_DISMISSALS_TABLE)
    .select('document_id, flag_id')
    .order('created_at', { ascending: true });
  if (dismissals.error) {
    throw new FlagDismissalError(
      `The flags readers set aside could not be counted: ${dismissals.error.message}`,
    );
  }

  return dismissalRatesOf(
    shown,
    (dismissals.data ?? []).map((row) => {
      const dismissal = row as Pick<FlagDismissalRow, 'document_id' | 'flag_id'>;
      return {
        documentId: dismissal.document_id,
        flagId: dismissal.flag_id,
      };
    }),
  );
}
