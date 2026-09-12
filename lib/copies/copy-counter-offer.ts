/**
 * Recording that a reader copied a counter-offer.
 *
 * The call arrives from a page with a document, a flag and the stance the page
 * says was showing. Only the first two are taken at their word, and even those
 * are checked against the reader's own stored read: the stance written down is
 * the stance of the draft the store actually holds for that flag. A page is
 * free to be wrong, out of date, or somebody's curl command, and none of that
 * reaches the metric.
 *
 * A gap cannot be copied. There is no branch here refusing one — the lookup
 * runs over `counterOffers`, and a gap has none (ADR-0014).
 */

import type { DocumentsGateway } from '../documents/store';
import {
  copiedCounterOfferIn,
  type CopiedCounterOffer,
  type CounterOfferCopiesGateway,
} from './store';

export interface CopyCounterOfferDeps {
  documents: DocumentsGateway;
  copies: CounterOfferCopiesGateway;
}

/**
 * What happened. The reader is not shown any of this: the wording is already on
 * their clipboard by the time this runs, and a count that did not get written
 * is not their problem. It comes back for the log, and for the tests.
 */
export type CopyCounterOfferResult =
  | { at: 'recorded'; copy: CopiedCounterOffer }
  | { at: 'refused'; reason: string };

const NOT_THIS_READERS = 'that document is not in this reader’s library';

const NOT_READ_YET = 'that document has not been read';

/**
 * Why a copy is not counted: the flag and stance name no draft of this read.
 * A gap lands here, as does a flag from a read that has since been replaced,
 * and as does a page reporting a stance the store has no draft in.
 */
const NO_SUCH_DRAFT =
  'this read holds no counter-offer for that flag in that stance';

/**
 * Writes down one copy of one counter-offer.
 *
 * `stance` is what the page reported, and it is used to find the stored draft
 * rather than to fill in the row. Nothing is written when no draft answers to
 * it, so the firm count can only ever grow by a firm draft that exists.
 */
export async function recordCounterOfferCopy(
  deps: CopyCounterOfferDeps,
  documentId: string,
  flagId: string,
  stance: string,
): Promise<CopyCounterOfferResult> {
  const document = await deps.documents.byId(documentId);
  if (!document) return { at: 'refused', reason: NOT_THIS_READERS };
  if (!document.analysis) return { at: 'refused', reason: NOT_READ_YET };

  const copy = copiedCounterOfferIn(
    documentId,
    document.analysis,
    flagId,
    stance,
  );
  if (!copy) return { at: 'refused', reason: NO_SUCH_DRAFT };

  await deps.copies.record(copy);
  return { at: 'recorded', copy };
}
