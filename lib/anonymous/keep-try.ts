import type { VerifiedFlag } from '../analysis/types';
import { toAnalysisResult, type DocumentsGateway } from '../documents/store';

/**
 * Keeping the document a visitor read without an account, once they have one.
 *
 * **Nothing here can call a model.** Not by discipline but because
 * `KeepTryDeps` names a documents gateway and nothing else: there is no model
 * client in this file, none in the type, and no import that reaches
 * `lib/model/`. The read already happened, in the tab, and this is the part
 * where it is written down. Re-reading the document here would charge the
 * visitor's new account for work that was already done and, worse, could hand
 * them a second opinion they never asked for on the agreement they just read.
 *
 * **The text is stored exactly as it arrived.** It is not trimmed, not
 * re-normalised and not rebuilt — see `keepTriedDocument` for why the smallest
 * touch here would be a silent break of ADR-0001 for this one document.
 */
export interface KeepTryDeps {
  documents: DocumentsGateway;
}

/**
 * What the tab is still holding: the name the visitor's file had, the text that
 * was analysed, and the analysis of it.
 *
 * `analysis` is `unknown` on purpose. It comes back over the wire from a
 * browser, so it is a claim about a read rather than a read, and it is checked
 * against `text` before anything is written.
 */
export interface KeptTry {
  name: string;
  text: string;
  analysis: unknown;
}

/** The saved document's id, or the reason there isn't one. */
export type KeepOutcome =
  | { id: string; refused?: undefined; status?: undefined }
  | { id?: undefined; refused: string; status: number };

/** What a visitor whose submitted read is not a read is told. */
export const NOT_A_READ_REASON =
  'Redline couldn’t make sense of the read this tab sent back, so it saved ' +
  'nothing. Your account is set up, so upload the file again and Redline will ' +
  'read it into your library.';

/**
 * What a visitor is told when the text and the read stopped matching.
 *
 * This is the refusal the ticket exists for. A saved document whose flags no
 * longer quote its own text is worse than no saved document at all, because
 * nothing about it looks wrong.
 */
export const CITATIONS_LOST_REASON =
  'The sentences in this read no longer match the text they came from. Redline ' +
  'won’t keep a read whose quotes it can’t stand behind, so this one isn’t in ' +
  'your library. Your account is set up: upload the file again for a fresh read.';

/** What a visitor is told when the document name is missing. */
export const NO_NAME_REASON =
  'The document needs a name so you can find it again.';

/**
 * Writes the visitor's read into their new library, or refuses to.
 *
 * The text goes into the row byte for byte as the tab held it. Every source
 * sentence was checked against that exact string during the read (ADR-0001),
 * and `findSourceSentence` collapses whitespace on both sides before it
 * compares — so a text that had been re-normalised on the way in would still
 * match, and would come back carrying *different whitespace* in the quote. The
 * flag would still verify and the reader would be shown a sentence their
 * document does not contain, character for character. That is the silent break
 * this function is here to make impossible, which is why it checks twice:
 *
 * 1. **Before the write**, against the text about to be stored. A read that
 *    does not verify is refused rather than written down.
 * 2. **After the write**, against the text the row came back holding, through
 *    the same gate a reopen goes through (`toStoredDocument`). If the round
 *    trip changed anything, the row is deleted and the visitor is told. A row
 *    that is not the document they read is not kept on the grounds that it is
 *    nearly right.
 */
export async function keepTriedDocument(
  deps: KeepTryDeps,
  kept: KeptTry,
): Promise<KeepOutcome> {
  const name = kept.name.trim();
  if (name.length === 0) {
    return { refused: NO_NAME_REASON, status: 422 };
  }

  const claimed = claimedCitations(kept.analysis);
  if (claimed === null) {
    return { refused: NOT_A_READ_REASON, status: 422 };
  }

  // Checked against the text that is about to be stored, not against the text
  // as the model saw it, because the stored one is what every future view will
  // quote from.
  const analysis = toAnalysisResult(kept.analysis, kept.text);
  if (analysis === null) {
    return { refused: NOT_A_READ_REASON, status: 422 };
  }
  if (!citationsHold(claimed, analysis.flags)) {
    return { refused: CITATIONS_LOST_REASON, status: 422 };
  }

  const created = await deps.documents.create({
    name: name.slice(0, 500),
    // Exactly what was analysed. No normalising, no trimming: see above.
    text: kept.text,
  });

  // The text is checked the moment the row comes back, before the analysis is
  // written on top of it. A row holding text that is not the text that was read
  // has nothing an analysis could correctly belong to.
  if (created.text !== kept.text) {
    await deps.documents.remove(created.id);
    return { refused: CITATIONS_LOST_REASON, status: 409 };
  }

  const stored = await deps.documents.recordAnalysis(created.id, analysis);

  if (
    stored.text !== kept.text ||
    !citationsHold(claimed, stored.analysis?.flags ?? [])
  ) {
    await deps.documents.remove(created.id);
    return { refused: CITATIONS_LOST_REASON, status: 409 };
  }

  return { id: created.id };
}

/** One flag as the tab claims it: which flag, and the sentence it quotes. */
interface Citation {
  id: string;
  sourceSentence: string;
}

/**
 * The citations the submitted read claims, or `null` if it is not a read at
 * all. Read off the raw claim rather than off anything verified, because these
 * are what the checks above compare the verified flags against.
 */
function claimedCitations(analysis: unknown): Citation[] | null {
  if (typeof analysis !== 'object' || analysis === null || Array.isArray(analysis)) {
    return null;
  }
  const record = analysis as Record<string, unknown>;
  if (typeof record.summary !== 'string' || record.summary.trim().length === 0) {
    return null;
  }
  if (!Array.isArray(record.flags) || !Array.isArray(record.gaps)) return null;

  const citations: Citation[] = [];
  for (const flag of record.flags as unknown[]) {
    if (typeof flag !== 'object' || flag === null) return null;
    const { id, sourceSentence } = flag as Record<string, unknown>;
    if (typeof id !== 'string' || typeof sourceSentence !== 'string') return null;
    citations.push({ id, sourceSentence });
  }
  return citations;
}

/**
 * Whether every flag the tab is showing came back verified against the stored
 * text, quoting the same wording down to its whitespace.
 *
 * A dropped flag fails this, and so does a flag that survived but came back
 * with its sentence cut differently — the second is the one a re-normalised
 * text would produce, and the one nobody would notice.
 */
function citationsHold(claimed: Citation[], kept: readonly VerifiedFlag[]): boolean {
  if (claimed.length !== kept.length) return false;
  const bySentence = new Map(kept.map((flag) => [flag.id, flag.sourceSentence]));
  return claimed.every(
    (citation) => bySentence.get(citation.id) === citation.sourceSentence,
  );
}
