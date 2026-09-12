'use server';

import { answerQuestion } from '@/lib/analysis/answer-question';
import {
  FIRM_DRAFT_FAILED,
  firmCounterOffer,
} from '@/lib/analysis/firm-counter-offer';
import { recordCounterOfferCopy } from '@/lib/copies/copy-counter-offer';
import { createSupabaseCounterOfferCopies } from '@/lib/copies/supabase-counter-offer-copies';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import {
  bringFlagBack,
  setFlagAside,
  SET_ASIDE_FAILED,
  type SetAsideDeps,
} from '@/lib/dismissals/set-aside-flag';
import { createSupabaseFlagDismissals } from '@/lib/dismissals/supabase-flag-dismissals';
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

/** What came back when a reader moved a flag out of their way, or back into it. */
export interface SetAsideState {
  /** Where the flag now sits, as the store has it. */
  setAside?: boolean;
  /** Why it did not move. Shown to the reader exactly as it arrives. */
  error?: string;
}

/** The stores behind setting a flag aside, for the reader who is signed in. */
function setAsideDeps(
  reader: NonNullable<Awaited<ReturnType<typeof currentReader>>>,
): SetAsideDeps {
  return {
    documents: createSupabaseDocuments(reader.supabase, reader.user.id),
    dismissals: createSupabaseFlagDismissals(reader.supabase, reader.user.id),
  };
}

/**
 * Moves one flag out of the reader's way.
 *
 * Nothing about the read changes: the flag keeps its place, its number and its
 * sentence, and the analysis is not rewritten. What is written is a row saying
 * this reader has dealt with this clause, which is what brings it back quietly
 * next time and what the rate is counted from.
 *
 * Whether a red line is what put the flag there is decided in
 * `setFlagAside`, from the stored read. The browser is not asked, because the
 * browser is not told (ADR-0013).
 */
export async function setFlagAsideAction(
  documentId: string,
  flagId: string,
): Promise<SetAsideState> {
  const reader = await currentReader();
  if (!reader) {
    return {
      error: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? 'Sign in to keep track of the flags you’ve dealt with.'
        : SIGN_IN_UNAVAILABLE,
    };
  }

  try {
    const result = await setFlagAside(setAsideDeps(reader), documentId, flagId);
    return result.at === 'set-aside'
      ? { setAside: true }
      : { error: 'reason' in result ? result.reason : SET_ASIDE_FAILED };
  } catch (error) {
    console.error(
      'Flag %s of document %s was not set aside',
      flagId,
      documentId,
      error,
    );
    return { error: SET_ASIDE_FAILED };
  }
}

/** Puts one flag back where it was, and deletes the record that it was moved. */
export async function bringFlagBackAction(
  documentId: string,
  flagId: string,
): Promise<SetAsideState> {
  const reader = await currentReader();
  if (!reader) {
    return {
      error: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? 'Sign in to keep track of the flags you’ve dealt with.'
        : SIGN_IN_UNAVAILABLE,
    };
  }

  try {
    const result = await bringFlagBack(setAsideDeps(reader), documentId, flagId);
    return result.at === 'brought-back'
      ? { setAside: false }
      : { error: 'reason' in result ? result.reason : SET_ASIDE_FAILED };
  } catch (error) {
    console.error(
      'Flag %s of document %s was not brought back',
      flagId,
      documentId,
      error,
    );
    return { error: SET_ASIDE_FAILED };
  }
}

/**
 * Writes down that the reader copied one flag's counter-offer.
 *
 * Returns nothing, and the page does not wait on it. The wording is already on
 * the clipboard by the time this runs, so there is no outcome the reader needs:
 * a count that did not get written is a gap in a metric, not something that
 * happened to their document. Nothing is shown to them either way.
 *
 * `stance` is what the page had on screen, and it is used to look the draft up
 * rather than to fill the row in. What is recorded is the stance of the draft
 * the store holds, so the firm count can only grow by a firm draft that exists
 * (ADR-0009, ADR-0012).
 */
export async function recordCounterOfferCopyAction(
  documentId: string,
  flagId: string,
  stance: string,
): Promise<void> {
  const reader = await currentReader();
  // No sign-in, no Supabase, no row. A visitor's one try has no drafted
  // counter-offer to copy, so there is nothing being dropped here.
  if (!reader) return;

  try {
    const result = await recordCounterOfferCopy(
      {
        documents: createSupabaseDocuments(reader.supabase, reader.user.id),
        copies: createSupabaseCounterOfferCopies(reader.supabase, reader.user.id),
      },
      documentId,
      flagId,
      stance,
    );
    if (result.at === 'refused') {
      console.warn(
        'A copy of flag %s of document %s was not counted: %s',
        flagId,
        documentId,
        result.reason,
      );
    }
  } catch (error) {
    console.error(
      'The copy of flag %s of document %s was not recorded',
      flagId,
      documentId,
      error,
    );
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
