'use server';

import { revalidatePath } from 'next/cache';
import { forgetDocument } from '@/lib/documents/library';
import { DocumentStoreError } from '@/lib/documents/store';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import { SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { currentReader } from '@/lib/supabase/server';

export interface LibraryFormState {
  error?: string;
}

/**
 * Deletes one document of the reader's own.
 *
 * The gateway is built around the signed-in reader here, so the id in the form
 * can only ever reach a row that belongs to them, and row level security
 * refuses it a second time in the database.
 */
export async function deleteDocument(
  _previous: LibraryFormState,
  formData: FormData,
): Promise<LibraryFormState> {
  const id = String(formData.get('id') ?? '');
  if (id.length === 0) {
    return { error: 'That document is no longer in your library.' };
  }

  const reader = await currentReader();
  if (!reader) {
    return {
      error: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? 'Sign in to see your library.'
        : SIGN_IN_UNAVAILABLE,
    };
  }

  try {
    const deleted = await forgetDocument(
      { documents: createSupabaseDocuments(reader.supabase, reader.user.id) },
      id,
    );
    if (!deleted) {
      return { error: 'That document is no longer in your library.' };
    }
  } catch (error) {
    if (error instanceof DocumentStoreError) {
      console.error('A document could not be deleted', error);
    } else {
      console.error('A delete did not finish', error);
    }
    return { error: 'That document didn’t delete. Try it again.' };
  }

  revalidatePath('/documents');
  return {};
}
