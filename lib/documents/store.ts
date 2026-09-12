import type { AnalysisResult } from '../analysis/types';
import { cleanReadFor } from '../analysis/clean-read';
import { aboveThreshold, rankGaps } from '../analysis/ranking';
import {
  applyRedLineOverride,
  type RedLineMatch,
} from '../analysis/red-line-override';
import {
  verifyCounterOffers,
  type CounterOfferClaim,
} from '../analysis/counter-offer';
import { verifyGaps, type GapClaim } from '../analysis/gap';
import { verifyFlags, type Flag } from '../analysis/verified-flag';

/**
 * A document as Redline keeps it: the text extracted in the reader's browser,
 * and the most recent analysis of that text. The file itself is never here,
 * because it never left the browser (`CLAUDE.md`, settled).
 */
export interface StoredDocument {
  id: string;
  name: string;
  text: string;
  /** Null until the analysis has run, and after one that failed. */
  analysis: AnalysisResult | null;
  createdAt: string;
  updatedAt: string;
}

/** A library row: everything but the text, which is never needed for a list. */
export type DocumentListing = Omit<StoredDocument, 'text' | 'analysis'> & {
  analysed: boolean;
};

/** The shape of a row in the `documents` table. */
export interface DocumentRow {
  id: string;
  name: string;
  extracted_text: string;
  analysis: unknown;
  created_at: string;
  updated_at: string;
}

/** Raised when the store cannot be read or written. */
export class DocumentStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentStoreError';
  }
}

/**
 * Everything the product does with stored documents. One reader's documents:
 * the owner is fixed when the gateway is built, and the database enforces the
 * same thing again through row level security.
 */
export interface DocumentsGateway {
  create(input: { name: string; text: string }): Promise<StoredDocument>;
  byId(id: string): Promise<StoredDocument | null>;
  list(): Promise<DocumentListing[]>;
  recordAnalysis(id: string, analysis: AnalysisResult): Promise<StoredDocument>;
}

/**
 * Turns a row into a document. The analysis column is jsonb, so whatever is in
 * it is checked rather than trusted: a row written by an older version of the
 * analysis reads as "not analysed" instead of rendering as a half-result.
 */
export function toStoredDocument(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    name: row.name,
    text: row.extracted_text,
    analysis: toAnalysisResult(row.analysis, row.extracted_text),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDocumentListing(row: Omit<DocumentRow, 'extracted_text'>): DocumentListing {
  return {
    id: row.id,
    name: row.name,
    analysed: storedAnalysis(row.analysis) !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The jsonb column, if it holds an analysis at all. */
function storedAnalysis(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.summary !== 'string' || record.summary.trim().length === 0) {
    return null;
  }
  if (!Array.isArray(record.flags) || !Array.isArray(record.gaps)) {
    return null;
  }
  return record;
}

/**
 * The stored analysis, or `null` if the column holds anything else.
 *
 * Every stored flag is checked against the document's text again on the way out.
 * The column is jsonb, so what a row holds is whatever was written into it, and
 * a row written by an older version of the analysis — or edited by hand — could
 * otherwise put a sentence in front of the reader that their document does not
 * contain (ADR-0001). A flag that no longer quotes the document is dropped here
 * exactly as it would have been during the run.
 *
 * Every stored gap goes back through `verifyGaps` for the same reason. A row
 * edited by hand could otherwise put a gap in front of the reader with a
 * sentence stapled to it, which is the one thing a gap may never carry
 * (ADR-0005), and the column is the one place that key could come from.
 */
export function toAnalysisResult(
  value: unknown,
  documentText: string,
): AnalysisResult | null {
  const record = storedAnalysis(value);
  if (!record) return null;

  const flagCheck = verifyFlags(
    (record.flags as unknown[]).filter(isStoredFlag),
    documentText,
  );
  const gapCheck = verifyGaps(
    (record.gaps as unknown[]).filter(isStoredGap),
    documentText,
  );

  const summary = record.summary as string;

  // The override is applied again on the way out rather than trusted from the
  // column, for the same reason the quotes are checked again: a red line kept a
  // flag on the page below the severity threshold (ADR-0013), so a row that lost
  // its match records would quietly drop it on the next read. What the column
  // cannot do is put a flag through that no longer quotes the document — these
  // records are matched against sentences that have already been through
  // `verifyFlags`, so a hand-edited row naming a sentence the document does not
  // contain marks nothing.
  const redLineBySentence = new Map(
    storedRedLineMatches(record).map((match) => [match.sourceSentence, match.redLine]),
  );
  const { flags, redLineMatches } = applyRedLineOverride(
    flagCheck.flags,
    redLineBySentence,
  );

  return {
    summary,
    flags,
    gaps: rankGaps(aboveThreshold(gapCheck.gaps)),
    // Worked out again from what came back through the two gates, never read off
    // the column. `cleanRead` is the field that tells a reader their agreement is
    // fine, and the column is jsonb: a row written by an older version of the
    // analysis, or edited by hand, is exactly where a clean read attached to a
    // document full of flags would come from (ADR-0008).
    cleanRead: cleanReadFor({ summary, flagCheck, gapCheck, shownFlags: flags }),
    redLineMatches,
    // Checked again against the flags that just came back through the citation
    // gate, never read off the column as written. A row is jsonb, so a stored
    // draft could otherwise name a flag this document no longer has, quote a
    // sentence the flag does not, or name a gap — and a gap with drafted clause
    // language stapled to it is the one thing ADR-0014 exists to prevent.
    //
    // Both stances come back out. A firm draft is in the column because a reader
    // asked for that clause in firm and it was kept there on purpose, and reading
    // it out again is what stops the next view redrafting it (ADR-0012).
    counterOffers: verifyCounterOffers(
      storedCounterOffers(record),
      flags,
    ).counterOffers,
  };
}

/** The counter-offers a row holds, ignoring anything that is not one. */
function storedCounterOffers(record: Record<string, unknown>): CounterOfferClaim[] {
  if (!Array.isArray(record.counterOffers)) return [];
  return (record.counterOffers as unknown[]).filter(isStoredCounterOffer);
}

/**
 * Whether a stored row's counter-offer has the fields one needs to be shown. It
 * is read as a `CounterOfferClaim`, not a `CounterOffer`: a row has been nowhere
 * near the flag it names, and `verifyCounterOffers` is what puts the two
 * together.
 */
function isStoredCounterOffer(value: unknown): value is CounterOfferClaim {
  if (typeof value !== 'object' || value === null) return false;
  const counterOffer = value as Record<string, unknown>;
  return (
    typeof counterOffer.flagId === 'string' &&
    typeof counterOffer.sourceSentence === 'string' &&
    typeof counterOffer.text === 'string' &&
    (counterOffer.stance === 'soft' || counterOffer.stance === 'firm')
  );
}

/** The match records a row holds, ignoring anything that is not one. */
function storedRedLineMatches(record: Record<string, unknown>): RedLineMatch[] {
  if (!Array.isArray(record.redLineMatches)) return [];
  return (record.redLineMatches as unknown[]).filter(isStoredRedLineMatch);
}

/**
 * Whether a stored row's match record has what it takes to mark a flag. It is
 * read as a claim about a sentence, never as permission: the sentence still has
 * to be one a verified flag came back carrying.
 */
function isStoredRedLineMatch(value: unknown): value is RedLineMatch {
  if (typeof value !== 'object' || value === null) return false;
  const match = value as Record<string, unknown>;
  return (
    typeof match.flagId === 'string' &&
    typeof match.redLine === 'string' &&
    match.redLine.trim().length > 0 &&
    typeof match.sourceSentence === 'string' &&
    match.sourceSentence.trim().length > 0
  );
}

/** Whether a stored row's flag has the fields a flag needs to be shown at all. */
function isStoredFlag(value: unknown): value is Flag {
  if (typeof value !== 'object' || value === null) return false;
  const flag = value as Record<string, unknown>;
  return (
    typeof flag.id === 'string' &&
    typeof flag.clauseType === 'string' &&
    typeof flag.sourceSentence === 'string' &&
    typeof flag.severity === 'number' &&
    typeof flag.explanation === 'string' &&
    typeof flag.band === 'string' &&
    typeof flag.textualAmbiguity === 'boolean' &&
    hasCheckableHedging(flag) &&
    (flag.harmConfidence === 'full' || flag.harmConfidence === 'partial')
  );
}

/**
 * Whether a stored row's hedge still has its two readings under it (ADR-0010).
 *
 * The column is jsonb, so a row is whatever was written into it. A row claiming
 * ambiguity with no readings attached is a hedge the reader has nothing to check,
 * which is the one thing hedged wording may never be, so the flag is dropped here
 * the same way a flag that no longer quotes the document is.
 */
function hasCheckableHedging(flag: Record<string, unknown>): boolean {
  if (flag.ambiguity === undefined || flag.ambiguity === null) {
    return flag.textualAmbiguity === false;
  }
  if (flag.textualAmbiguity !== true) return false;

  const ambiguity = flag.ambiguity as Record<string, unknown>;
  return (
    typeof ambiguity.hedge === 'string' &&
    ambiguity.hedge.trim().length > 0 &&
    Array.isArray(ambiguity.readings) &&
    ambiguity.readings.length === 2 &&
    ambiguity.readings.every(
      (reading) => typeof reading === 'string' && reading.trim().length > 0,
    )
  );
}

/**
 * Whether a stored row's gap has the fields a gap needs to be shown. It is read
 * as a `GapClaim`, not a `Gap`: a row has been nowhere near `verifyGaps`, and
 * saying otherwise here would hand the reader the guarantee without the check.
 */
function isStoredGap(value: unknown): value is GapClaim {
  if (typeof value !== 'object' || value === null) return false;
  const gap = value as Record<string, unknown>;
  return (
    typeof gap.id === 'string' &&
    typeof gap.statement === 'string' &&
    typeof gap.severity === 'number' &&
    typeof gap.explanation === 'string' &&
    typeof gap.band === 'string'
  );
}
