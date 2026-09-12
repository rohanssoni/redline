import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnalysisResult } from '../analysis/types';
import {
  DocumentStoreError,
  toDocumentListing,
  toStoredDocument,
  type DocumentListing,
  type DocumentRow,
  type DocumentsGateway,
  type StoredDocument,
} from './store';

export const DOCUMENTS_TABLE = 'documents';

const ROW_COLUMNS = 'id, name, extracted_text, analysis, created_at, updated_at';
const LISTING_COLUMNS = 'id, name, analysis, created_at, updated_at';

/**
 * The `documents` table, for one reader. Every query names the owner as well,
 * so a bug in a caller cannot widen what comes back even before row level
 * security refuses it.
 */
export function createSupabaseDocuments(
  supabase: SupabaseClient,
  ownerId: string,
): DocumentsGateway {
  const table = () => supabase.from(DOCUMENTS_TABLE);

  return {
    async create({ name, text }): Promise<StoredDocument> {
      const { data, error } = await table()
        .insert({ owner_id: ownerId, name, extracted_text: text })
        .select(ROW_COLUMNS)
        .single();
      if (error || !data) {
        throw new DocumentStoreError(
          `The document could not be saved: ${error?.message ?? 'no row came back'}`,
        );
      }
      return toStoredDocument(data as DocumentRow);
    },

    async byId(id): Promise<StoredDocument | null> {
      const { data, error } = await table()
        .select(ROW_COLUMNS)
        .eq('id', id)
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (error) {
        throw new DocumentStoreError(
          `The document could not be read: ${error.message}`,
        );
      }
      return data ? toStoredDocument(data as DocumentRow) : null;
    },

    async list(): Promise<DocumentListing[]> {
      const { data, error } = await table()
        .select(LISTING_COLUMNS)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });
      if (error) {
        throw new DocumentStoreError(
          `The library could not be read: ${error.message}`,
        );
      }
      return (data ?? []).map((row) =>
        toDocumentListing(row as Omit<DocumentRow, 'extracted_text'>),
      );
    },

    async recordAnalysis(id, analysis: AnalysisResult): Promise<StoredDocument> {
      const { data, error } = await table()
        .update({ analysis, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select(ROW_COLUMNS)
        .single();
      if (error || !data) {
        throw new DocumentStoreError(
          `The analysis could not be saved: ${error?.message ?? 'no row came back'}`,
        );
      }
      return toStoredDocument(data as DocumentRow);
    },

    /**
     * Deletes and asks for the row back, so a delete that matched nothing —
     * someone else's document, or one already gone — is told apart from one
     * that did the work.
     *
     * The row is everything Redline held: the extracted text and the analysis
     * are columns of it, and there is no file anywhere to delete alongside
     * (`CLAUDE.md`, settled). So this is the deletion, not a flag that hides
     * the document from a list while the text stays in the table.
     */
    async remove(id): Promise<boolean> {
      const { data, error } = await table()
        .delete()
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select('id')
        .maybeSingle();
      if (error) {
        throw new DocumentStoreError(
          `The document could not be deleted: ${error.message}`,
        );
      }
      return data !== null;
    },
  };
}
