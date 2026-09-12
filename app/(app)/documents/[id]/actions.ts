'use server';

import { answerQuestion } from '@/lib/analysis/answer-question';
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

/** What came back for one question: an answer from the document, or a reason there is none. */
export interface QuestionState {
  answer?: string;
  /** Why there is no answer. Shown to the reader exactly as it arrives. */
  reason?: string;
}

/** What the reader is told when the answering itself didn't finish. */
const ASK_FAILED =
  'That question didn’t get through. Nothing about your document has changed, so try it again.';

/**
 * Puts one question to one document the reader owns.
 *
 * The text comes out of the store rather than off the page, so what is answered
 * from is the document Redline read. A question the seam declines comes back
 * with its reason and is shown as it stands: the decline is the product working
 * (ADR-0003, ADR-0014), not an error, and nothing here rewords it.
 */
export async function askAboutDocument(
  documentId: string,
  question: string,
): Promise<QuestionState> {
  const reader = await currentReader();
  if (!reader) {
    return {
      reason: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? 'Sign in to ask about this document.'
        : SIGN_IN_UNAVAILABLE,
    };
  }

  try {
    const document = await createSupabaseDocuments(
      reader.supabase,
      reader.user.id,
    ).byId(documentId);
    if (!document) {
      return {
        reason: 'That document isn’t in your library any more, so there’s nothing to ask about.',
      };
    }

    const result = await answerQuestion(document.text, question, {
      model: createOpenRouterClient(),
    });
    return 'declined' in result
      ? { reason: result.reason }
      : { answer: result.answer };
  } catch (error) {
    console.error(
      'The question put to document %s did not finish',
      documentId,
      error,
    );
    return { reason: ASK_FAILED };
  }
}
