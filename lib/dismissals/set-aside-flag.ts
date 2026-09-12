/**
 * Setting a flag aside, and bringing it back.
 *
 * Both go through the document's own stored read rather than trusting what came
 * off the page. Two things fall out of that, and both matter:
 *
 * 1. **Whether a red line put the flag there is decided here.** The reader is
 *    shown no marker for a red line match (ADR-0013), so the browser does not
 *    know and must not be asked. The answer comes from the analysis.
 * 2. **A gap cannot be set aside.** An id is looked up in `flags`, and a gap is
 *    not in that list. There is no argument to carve an exception with, so
 *    "gaps are not part of this metric" holds however the call is made.
 */

import type { DocumentsGateway } from '../documents/store';
import {
  shownFlagIn,
  type FlagDismissalsGateway,
  type ShownFlag,
} from './store';

export interface SetAsideDeps {
  documents: DocumentsGateway;
  dismissals: FlagDismissalsGateway;
}

/**
 * What happened, and what the reader is told when nothing did.
 *
 * `flag` comes back on the way in so a caller can say which flag moved without
 * asking the store again; it is the record that was written, red line mark and
 * all.
 */
export type SetAsideResult =
  | { at: 'set-aside'; flag: ShownFlag }
  | { at: 'brought-back'; flagId: string }
  | { at: 'refused'; reason: string };

const NOT_THIS_READERS =
  'That document isn’t in your library any more, so there’s nothing to set aside.';

const NOT_READ_YET =
  'This document hasn’t been read yet, so there’s nothing to set aside.';

/**
 * What a reader is told when the id names something that is not a flag of this
 * read — a gap, or a flag from a read that has since been replaced.
 */
const NOT_A_FLAG_HERE =
  'That isn’t one of the flags on this read, so there’s nothing to move.';

/** What a reader is told when setting aside or restoring did not go through. */
export const SET_ASIDE_FAILED =
  'That didn’t go through. The flag is where it was, so try it again.';

/**
 * Sets one flag of one document aside for the reader who owns it.
 *
 * The flag stays in the read. Nothing is deleted, rewritten or renumbered: the
 * dismissal is a row beside the analysis saying this reader has dealt with this
 * clause, which is what lets them bring it back and what lets the rate be
 * counted against the flags that were actually shown.
 */
export async function setFlagAside(
  deps: SetAsideDeps,
  documentId: string,
  flagId: string,
): Promise<SetAsideResult> {
  const flag = await flagOf(deps, documentId, flagId);
  if ('at' in flag) return flag;

  await deps.dismissals.dismiss(flag);
  return { at: 'set-aside', flag };
}

/**
 * Brings one flag back into the read.
 *
 * The row is deleted rather than marked undone. A reader who set a flag aside
 * and changed their mind did not dismiss it, and a rate that counted them as
 * having done so would be reporting a decision nobody made.
 */
export async function bringFlagBack(
  deps: SetAsideDeps,
  documentId: string,
  flagId: string,
): Promise<SetAsideResult> {
  const flag = await flagOf(deps, documentId, flagId);
  if ('at' in flag) return flag;

  await deps.dismissals.restore(documentId, flagId);
  return { at: 'brought-back', flagId };
}

/** Which of this document's flags the reader has set aside. */
export async function flagsSetAside(
  deps: Pick<SetAsideDeps, 'dismissals'>,
  documentId: string,
): Promise<string[]> {
  const dismissed = await deps.dismissals.forDocument(documentId);
  return dismissed.map((flag) => flag.flagId);
}

/**
 * The flag this call is about, as the stored read has it, or the refusal the
 * reader gets instead. Every path into the table goes through here.
 */
async function flagOf(
  deps: SetAsideDeps,
  documentId: string,
  flagId: string,
): Promise<ShownFlag | Extract<SetAsideResult, { at: 'refused' }>> {
  const document = await deps.documents.byId(documentId);
  if (!document) return { at: 'refused', reason: NOT_THIS_READERS };
  if (!document.analysis) return { at: 'refused', reason: NOT_READ_YET };

  const flag = shownFlagIn(documentId, document.analysis, flagId);
  if (!flag) return { at: 'refused', reason: NOT_A_FLAG_HERE };
  return flag;
}
