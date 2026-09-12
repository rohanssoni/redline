import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RedLineStoreError,
  toRedLine,
  type RedLine,
  type RedLineRow,
  type RedLinesGateway,
} from './store';

export const RED_LINES_TABLE = 'red_lines';

const ROW_COLUMNS = 'id, text, created_at, updated_at';

/**
 * The `red_lines` table, for one reader. Every query names the owner as well,
 * so a bug in a caller cannot widen what comes back or what is changed even
 * before row level security refuses it.
 */
export function createSupabaseRedLines(
  supabase: SupabaseClient,
  ownerId: string,
): RedLinesGateway {
  const table = () => supabase.from(RED_LINES_TABLE);

  return {
    async list(): Promise<RedLine[]> {
      const { data, error } = await table()
        .select(ROW_COLUMNS)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true });
      if (error) {
        throw new RedLineStoreError(
          `Your red lines could not be read: ${error.message}`,
        );
      }
      return (data ?? []).map((row) => toRedLine(row as RedLineRow));
    },

    async add(text): Promise<RedLine> {
      const { data, error } = await table()
        .insert({ owner_id: ownerId, text })
        .select(ROW_COLUMNS)
        .single();
      if (error || !data) {
        throw new RedLineStoreError(
          `That red line could not be saved: ${error?.message ?? 'no row came back'}`,
        );
      }
      return toRedLine(data as RedLineRow);
    },

    async edit(id, text): Promise<RedLine> {
      const { data, error } = await table()
        .update({ text, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select(ROW_COLUMNS)
        .single();
      if (error || !data) {
        throw new RedLineStoreError(
          `That red line could not be changed: ${error?.message ?? 'no row came back'}`,
        );
      }
      return toRedLine(data as RedLineRow);
    },

    /**
     * Deletes and asks for the row back, so a delete that matched nothing —
     * somebody else's red line, or one already gone — is told apart from one
     * that did the work, rather than reported as a success either way.
     */
    async remove(id): Promise<boolean> {
      const { data, error } = await table()
        .delete()
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select(ROW_COLUMNS)
        .maybeSingle();
      if (error) {
        throw new RedLineStoreError(
          `That red line could not be removed: ${error.message}`,
        );
      }
      return data !== null;
    },
  };
}
