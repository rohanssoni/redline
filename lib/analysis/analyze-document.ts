import type { ObjectSchema } from '../model/json-schema';
import type { StructuredRequest } from '../model/client';
import {
  MINIMUM_READABLE_CHARACTERS,
  normalizeDocumentText,
  readableCharacterCount,
} from '../document-text';
import { AnalysisError, type AnalysisDeps, type AnalysisResult } from './types';

/**
 * What the model is asked for in the summary stage. `strict: true` on the
 * request means these are the only keys that can come back.
 */
export const summarySchema: ObjectSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description:
        'A plain-English summary of the agreement, four to eight sentences, stating only what the document says.',
      minLength: 80,
    },
  },
  required: ['summary'],
  additionalProperties: false,
};

interface SummaryOutput {
  summary: string;
}

const SUMMARY_SYSTEM_PROMPT = [
  'You summarise an agreement for the person being asked to sign it.',
  '',
  'Rules:',
  '- State only what the document says. If the text does not support a claim, leave it out.',
  '- Do not say whether a term is good, bad, risky, fair, standard or unusual. Another stage does that.',
  '- Do not quote the document. Write in your own plain words.',
  '- Do not say what a court would do, or what the law in any place requires.',
  '- Address the reader as "you" and the other side by the name the document uses.',
  '- Cover what the work is, what the money terms are, how the agreement ends, and what the reader gives up or keeps.',
  '- Four to eight sentences. No lists, no headings, no preamble such as "This document is".',
].join('\n');

/** The prompt for one document. Exported so a test can read what was sent. */
export function summaryRequest(text: string): StructuredRequest {
  return {
    name: 'document_summary',
    schema: summarySchema,
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Summarise the agreement below.\n\n---\n${text}\n---`,
      },
    ],
  };
}

/**
 * Reads one document.
 *
 * The summary stage is what runs today: flags and gaps arrive with the ranking
 * stage, and the red lines the reader has set are what that stage will match
 * against. The summary carries no severity and no source sentences — those
 * belong to flags and gaps (PRD §1, ADR-0005).
 */
export async function analyzeDocument(
  text: string,
  redLines: string[],
  deps: AnalysisDeps,
): Promise<AnalysisResult> {
  // The reader's red lines are matched by the ranking stage, which the summary
  // never sees: a summary that leaned on them would describe the reader's
  // priorities rather than the document (`CLAUDE.md`, standing rule).
  void redLines;

  const documentText = normalizeDocumentText(text);
  if (readableCharacterCount(documentText) < MINIMUM_READABLE_CHARACTERS) {
    throw new AnalysisError(
      'There is not enough text in this document to read.',
    );
  }

  const { summary } = await deps.model.complete<SummaryOutput>(
    summaryRequest(documentText),
  );

  return {
    summary: summary.trim(),
    flags: [],
    gaps: [],
  };
}
