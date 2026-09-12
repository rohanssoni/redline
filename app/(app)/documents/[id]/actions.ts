'use server';

import {
  FIRM_DRAFT_FAILED,
  firmCounterOffer,
} from '@/lib/analysis/firm-counter-offer';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import { createOpenRouterClient } from '@/lib/model/openrouter';
import { SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { currentReader } from '@/lib/supabase/server';

/** The firmer wording for one flag, or what stopped it arriving. */
export interface FirmCounterOfferState {
  text?: string;
  error?: string;
}

/**
 * Draws the firm counter-offer for one flag of one document, which is drafted
 * here and only here — the moment a reader asks for it, for the clause they
 * asked about (ADR-0012). Nothing calls this during a read.
 *
 * The draft is kept with the document before it comes back, so the reader who
 * switches away and back, or opens the document next week, is handed the same
 * wording rather than a second model call.
 */
export async function requestFirmCounterOffer(
  documentId: string,
  flagId: string,
): Promise<FirmCounterOfferState> {
  const reader = await currentReader();
  if (!reader) {
    return {
      error: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? 'Sign in to redraft this clause.'
        : SIGN_IN_UNAVAILABLE,
    };
  }

  try {
    const result = await firmCounterOffer(
      {
        documents: createSupabaseDocuments(reader.supabase, reader.user.id),
        model: createOpenRouterClient(),
      },
      documentId,
      flagId,
    );
    return result.at === 'drafted'
      ? { text: result.counterOffer.text }
      : { error: result.reason };
  } catch (error) {
    console.error(
      'The firm counter-offer for flag %s of document %s did not finish',
      flagId,
      documentId,
      error,
    );
    // The same words the drafting itself uses when it cannot finish. What broke
    // is in the log above; what the reader needs to know is that the wording on
    // screen is untouched and asking again is worth doing.
    return { error: FIRM_DRAFT_FAILED };
  }
}
