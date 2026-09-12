import { NextResponse } from 'next/server';
import { readDocument } from '@/lib/analysis/read-document';
import { AnalysisError } from '@/lib/analysis/types';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import { createSupabaseRedLines } from '@/lib/red-lines/supabase-red-lines';
import { createOpenRouterClient } from '@/lib/model/openrouter';
import { SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { currentReader } from '@/lib/supabase/server';

/**
 * Reads a stored document and keeps the result with it. The reader's own red
 * lines drive this read, and they are fetched inside `readDocument` on every
 * run rather than carried in from anywhere.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const reader = await currentReader();
  if (!reader) {
    return NextResponse.json(
      {
        error: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? 'Sign in to read a document.'
          : SIGN_IN_UNAVAILABLE,
      },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const saved = await readDocument(
      {
        documents: createSupabaseDocuments(reader.supabase, reader.user.id),
        redLines: createSupabaseRedLines(reader.supabase, reader.user.id),
        model: createOpenRouterClient(),
      },
      id,
    );
    if (!saved) {
      return NextResponse.json(
        { error: 'That document isn’t in your library.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ analysis: saved.analysis });
  } catch (error) {
    console.error('The analysis of document %s did not finish', id, error);
    return NextResponse.json(
      {
        error:
          error instanceof AnalysisError
            ? error.message
            : 'The read didn’t finish. Your document is saved, so you can start it again.',
      },
      { status: 502 },
    );
  }
}
