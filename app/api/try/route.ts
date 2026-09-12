import { NextResponse } from 'next/server';
import { allowanceFor, callerAddress } from '@/lib/anonymous/try-allowance';
import { tryDocument } from '@/lib/anonymous/try-document';
import { AnalysisError } from '@/lib/analysis/types';
import { createOpenRouterClient } from '@/lib/model/openrouter';
import { currentReader, serverSupabase } from '@/lib/supabase/server';

/**
 * One read without an account.
 *
 * Takes the text and answers with the read. It has no documents gateway, writes
 * nothing about the document anywhere, and returns the result rather than an id,
 * because there is nothing to have an id: the text lives in the visitor's tab
 * for as long as they keep the page open and nowhere else.
 *
 * Like `/api/documents`, this reads JSON and has no file-handling path, so the
 * original file cannot reach the server even by mistake. Parsing happens in the
 * browser (`CLAUDE.md`, settled).
 *
 * What this route does reach Supabase for is the count of tries this caller has
 * had today, and `allowanceFor` is the whole of that decision: a signed-in
 * reader is not metered, a copy with no project configured has no count to keep,
 * and everybody else is counted before a model is called.
 */
export async function POST(request: Request) {
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

  const { text } = (body ?? {}) as { text?: unknown };
  if (typeof text !== 'string') {
    return NextResponse.json(
      { error: 'Send the text of the document as JSON.' },
      { status: 422 },
    );
  }

  // Read only to decide whether the daily limit applies. Nothing below this line
  // writes as the reader, and a signed-out visitor is the ordinary case rather
  // than a failure.
  const reader = await currentReader();
  const supabase = reader?.supabase ?? (await serverSupabase());

  try {
    const outcome = await tryDocument(
      {
        model: createOpenRouterClient(),
        allowance: allowanceFor({
          supabase,
          signedIn: reader !== null,
          address: callerAddress(request.headers),
          now: new Date(),
        }),
      },
      text,
    );

    if (outcome.refused !== undefined) {
      return NextResponse.json(
        { error: outcome.refused },
        { status: outcome.status },
      );
    }

    return NextResponse.json({ read: outcome.read });
  } catch (error) {
    console.error('A try without an account did not finish', error);
    return NextResponse.json(
      {
        error:
          error instanceof AnalysisError
            ? error.message
            : 'The read didn’t finish. Nothing was saved, so you can start it again.',
      },
      { status: 502 },
    );
  }
}
