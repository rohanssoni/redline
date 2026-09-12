/**
 * The firm counter-offer for one flag, drafted the moment a reader asks for it
 * and never before (ADR-0012).
 *
 * Two things this module is built around:
 *
 * 1. **Nothing here runs during an analysis.** `analyzeDocument` and
 *    `readDocument` never call it, so a document that has just been read holds
 *    the soft draft for each flag and nothing else. There is no warming, no
 *    prefetch and no batch: a firm draft exists because a reader switched one
 *    clause to firm.
 * 2. **A drafted firm version is kept with the document.** It is written into
 *    the same analysis the soft drafts live in, so switching back and forth, and
 *    reopening the document tomorrow, read it out of the store rather than
 *    paying for it again. The check for one already being there happens before
 *    the model is reached, which is what makes that true rather than intended.
 */

import type { ModelClient } from '../model/client';
import type { DocumentsGateway } from '../documents/store';
import { draftCounterOffer, type CounterOffer } from './counter-offer';

export interface FirmCounterOfferDeps {
  documents: DocumentsGateway;
  model: ModelClient;
}

/**
 * What came back for the reader: the firm wording, or a reason there is none.
 *
 * There is no third case where the wording is empty. A flag whose firm draft
 * could not be made keeps the soft one it already has, and the reader is told
 * what happened — the soft draft is never replaced, emptied or reworded by a
 * firm attempt that failed.
 */
export type FirmCounterOfferResult =
  | { at: 'drafted'; counterOffer: CounterOffer; fromStore: boolean }
  | { at: 'refused'; reason: string };

/** What the reader is told when a firm draft could not be made. */
export const FIRM_DRAFT_FAILED =
  'The firmer wording didn’t come back. The wording below still stands, and you can ask again.';

const NOT_THIS_READERS =
  'That document isn’t in your library any more, so there’s nothing to redraft.';

const NOT_READ_YET =
  'This document hasn’t been read yet, so there’s no clause here to redraft.';

const FLAG_IS_GONE =
  'That clause isn’t in this read any more. Read the document again to pick it up.';

/**
 * Gets the firm counter-offer for one flag of one document, drafting it if this
 * is the first time the reader has asked.
 *
 * Returns the stored draft untouched when there is one, without reaching the
 * model. Otherwise it drafts one, and keeps it with the document before handing
 * it back — a draft the reader saw but that was never written down would be
 * redrafted, and paid for, on the next view.
 */
export async function firmCounterOffer(
  deps: FirmCounterOfferDeps,
  documentId: string,
  flagId: string,
): Promise<FirmCounterOfferResult> {
  const document = await deps.documents.byId(documentId);
  if (!document) return { at: 'refused', reason: NOT_THIS_READERS };

  const analysis = document.analysis;
  if (!analysis) return { at: 'refused', reason: NOT_READ_YET };

  // Before the model, always. This is the line that makes a second switch to
  // firm, and every later view of the document, free (ADR-0012).
  const kept = analysis.counterOffers.find(
    (counterOffer) => counterOffer.flagId === flagId && counterOffer.stance === 'firm',
  );
  if (kept) return { at: 'drafted', counterOffer: kept, fromStore: true };

  const flag = analysis.flags.find((each) => each.id === flagId);
  if (!flag) return { at: 'refused', reason: FLAG_IS_GONE };

  let drafted: CounterOffer | null;
  try {
    drafted = await draftCounterOffer(flag, 'firm', { model: deps.model });
  } catch (error) {
    console.warn(
      'The firm counter-offer for %s was not drafted: %s',
      flagId,
      error instanceof Error ? error.message : String(error),
    );
    return { at: 'refused', reason: FIRM_DRAFT_FAILED };
  }

  // `draftCounterOffer` returns null for a draft that rewrote some other
  // sentence. The reader is told the firmer wording did not arrive, which is
  // what happened: a draft anchored to the wrong clause is not a draft.
  if (!drafted) return { at: 'refused', reason: FIRM_DRAFT_FAILED };

  const saved = await deps.documents.recordAnalysis(documentId, {
    ...analysis,
    counterOffers: [...analysis.counterOffers, drafted],
  });

  // Handed back from what the store returned, not from what was sent to it, so
  // the reader sees the draft that survived the round trip through the column.
  const stored = saved.analysis?.counterOffers.find(
    (counterOffer) => counterOffer.flagId === flagId && counterOffer.stance === 'firm',
  );
  if (!stored) return { at: 'refused', reason: FIRM_DRAFT_FAILED };

  return { at: 'drafted', counterOffer: stored, fromStore: false };
}
