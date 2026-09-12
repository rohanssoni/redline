import type { AnalysisResult } from '../analysis/types';

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
    analysis: toAnalysisResult(row.analysis),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDocumentListing(row: Omit<DocumentRow, 'extracted_text'>): DocumentListing {
  return {
    id: row.id,
    name: row.name,
    analysed: toAnalysisResult(row.analysis) !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The stored analysis, or `null` if the column holds anything else. */
export function toAnalysisResult(value: unknown): AnalysisResult | null {
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
  return {
    summary: record.summary,
    flags: record.flags as AnalysisResult['flags'],
    gaps: record.gaps as AnalysisResult['gaps'],
  };
}
