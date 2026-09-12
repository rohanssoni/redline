import { NextResponse } from 'next/server';
import { keepTriedDocument } from '@/lib/anonymous/keep-try';
import { DocumentStoreError } from '@/lib/documents/store';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import { SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { currentReader } from '@/lib/supabase/server';

/**
 * Keeps a read that happened without an account, for the reader who has just
 * made one.
 *
 * There is no model client in this file and nothing below it reaches one. The
 * request carries the read, because the tab still has it: re-running it here
 * would cost the new account a read it already had, and could answer
 * differently from the page the reader is looking at while they sign up.
 *
 * Like the other two document routes this reads JSON, so the original file
 * cannot reach the server even by mistake (`CLAUDE.md`, settled). What it does
 * not do, unlike `/api/documents`, is normalise the text: this text has already
 * been analysed, and touching it now would break every quote that was checked
 * against it (ADR-0001, and the long note in `keep-try.ts`).
 */
export async function POST(request: Request) {
  const reader = await currentReader();
  if (!reader) {
    return NextResponse.json(
      {
        error: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? 'Sign in to keep this document.'
          : SIGN_IN_UNAVAILABLE,
      },
      { status: 401 },
    );
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: 'Send the text of the document as JSON.' },
      { status: 415 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Send the text of the document as JSON.' },
      { status: 400 },
    );
  }

  const { name, text, analysis } = (body ?? {}) as {
    name?: unknown;
    text?: unknown;
    analysis?: unknown;
  };
  if (typeof name !== 'string' || typeof text !== 'string') {
    return NextResponse.json(
      { error: 'Send the text of the document as JSON.' },
      { status: 422 },
    );
  }

  try {
    const outcome = await keepTriedDocument(
      {
        documents: createSupabaseDocuments(reader.supabase, reader.user.id),
      },
      { name, text, analysis },
    );

    if (outcome.refused !== undefined) {
      return NextResponse.json(
        { error: outcome.refused },
        { status: outcome.status },
      );
    }

    return NextResponse.json({ id: outcome.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DocumentStoreError
            ? error.message
            : 'The document couldn’t be saved. Try it again.',
      },
      { status: 500 },
    );
  }
}
