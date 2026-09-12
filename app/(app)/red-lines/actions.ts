'use server';

import { revalidatePath } from 'next/cache';
import { checkRedLine, RedLineStoreError } from '@/lib/red-lines/store';
import { createSupabaseRedLines } from '@/lib/red-lines/supabase-red-lines';
import { SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { currentReader } from '@/lib/supabase/server';

export interface RedLineFormState {
  error?: string;
}

/**
 * The reader's own list, for the reader who is signed in. Every action goes
 * through here, so none of them can reach a row that is not theirs.
 */
async function readersRedLines() {
  const reader = await currentReader();
  if (!reader) return null;
  return createSupabaseRedLines(reader.supabase, reader.user.id);
}

function signedOut(): RedLineFormState {
  return {
    error: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? 'Sign in to keep a list of red lines.'
      : SIGN_IN_UNAVAILABLE,
  };
}

/** Supabase says what went wrong in its own words. This says it in the reader's. */
function refused(error: unknown, fallback: string): RedLineFormState {
  if (error instanceof RedLineStoreError) {
    console.error('A red line could not be written', error);
  } else {
    console.error('A red line action did not finish', error);
  }
  return { error: fallback };
}

export async function addRedLine(
  _previous: RedLineFormState,
  formData: FormData,
): Promise<RedLineFormState> {
  const checked = checkRedLine(String(formData.get('text') ?? ''));
  if ('problem' in checked) return { error: checked.problem };

  const redLines = await readersRedLines();
  if (!redLines) return signedOut();

  try {
    await redLines.add(checked.text);
  } catch (error) {
    return refused(error, 'That red line didn’t save. Try it again.');
  }

  revalidatePath('/red-lines');
  return {};
}

export async function editRedLine(
  _previous: RedLineFormState,
  formData: FormData,
): Promise<RedLineFormState> {
  const id = String(formData.get('id') ?? '');
  if (id.length === 0) return { error: 'That red line is no longer on your list.' };

  const checked = checkRedLine(String(formData.get('text') ?? ''));
  if ('problem' in checked) return { error: checked.problem };

  const redLines = await readersRedLines();
  if (!redLines) return signedOut();

  try {
    await redLines.edit(id, checked.text);
  } catch (error) {
    return refused(error, 'That change didn’t save. Try it again.');
  }

  revalidatePath('/red-lines');
  return {};
}

export async function removeRedLine(
  _previous: RedLineFormState,
  formData: FormData,
): Promise<RedLineFormState> {
  const id = String(formData.get('id') ?? '');
  if (id.length === 0) return { error: 'That red line is no longer on your list.' };

  const redLines = await readersRedLines();
  if (!redLines) return signedOut();

  try {
    const removed = await redLines.remove(id);
    if (!removed) {
      return { error: 'That red line is no longer on your list.' };
    }
  } catch (error) {
    return refused(error, 'That red line didn’t come off the list. Try it again.');
  }

  revalidatePath('/red-lines');
  return {};
}
