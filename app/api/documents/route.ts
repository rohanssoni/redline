import { NextResponse } from 'next/server';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import { DocumentStoreError } from '@/lib/documents/store';
import {
  MINIMUM_READABLE_CHARACTERS,
  normalizeDocumentText,
  readableCharacterCount,
} from '@/lib/document-text';
import { SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { currentReader } from '@/lib/supabase/server';

/**
 * Takes the text of a document and nothing else.
 *
 * There is no file-handling path here on purpose: this route reads JSON, so the
 * original file cannot reach the server even by mistake. Parsing happens in the
 * browser (`CLAUDE.md`, settled).
 */
export async function POST(request: Request) {
  const reader = await currentReader();
  if (!reader) {
    return NextResponse.json(
      { error: signedOutMessage() },
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
    return NextResponse.json({ error: 'Send the text of the document as JSON.' }, {
      status: 400,
    });
  }

  const { name, text } = (body ?? {}) as { name?: unknown; text?: unknown };
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { error: 'The document needs a name so you can find it again.' },
      { status: 422 },
    );
  }
  if (typeof text !== 'string') {
    return NextResponse.json(
      { error: 'Send the text of the document as JSON.' },
      { status: 422 },
    );
  }

  const documentText = normalizeDocumentText(text);
  if (readableCharacterCount(documentText) < MINIMUM_READABLE_CHARACTERS) {
    return NextResponse.json(
      {
        error:
          'There isn’t enough text here to read. If the pages are scans or photographs, Redline can’t read them.',
      },
      { status: 422 },
    );
  }

  try {
    const documents = createSupabaseDocuments(reader.supabase, reader.user.id);
    const saved = await documents.create({
      name: name.trim().slice(0, 500),
      text: documentText,
    });
    return NextResponse.json({ id: saved.id }, { status: 201 });
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

function signedOutMessage(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
    ? 'Sign in to read a document.'
    : SIGN_IN_UNAVAILABLE;
}
