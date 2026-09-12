import type { ObjectSchema } from '../model/json-schema';
import type { StructuredRequest } from '../model/client';
import {
  MINIMUM_READABLE_CHARACTERS,
  normalizeDocumentText,
  readableCharacterCount,
} from '../document-text';
import { AnalysisError, type AnalysisDeps, type AnalysisResult } from './types';
import { bandFor, dangerousOnly, rankFlags, rankGaps } from './ranking';
import { verifyGaps, type GapClaim } from './gap';
import { verifyFlags, type ProposedFlag } from './verified-flag';

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
 * What the model is asked for in the flag stage. The quote comes back as its own
 * field so it can be checked against the document, and the two plausibility
 * signals come back separately from severity so the filter of ADR-0004 runs here
 * rather than inside the model's number.
 */
export const flagsSchema: ObjectSchema = {
  type: 'object',
  properties: {
    flags: {
      type: 'array',
      description:
        'Every clause in this agreement that could cost the reader, one entry per sentence.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'A short lowercase name for the clause, words joined by hyphens, such as uncapped-indemnity.',
            minLength: 2,
          },
          clauseType: {
            type: 'string',
            description:
              'What kind of clause this is, in three or four plain words, such as "unilateral scope change".',
            minLength: 3,
          },
          sourceSentence: {
            type: 'string',
            description:
              'One sentence copied from the agreement character for character. Never tidied, shortened, joined or repunctuated.',
            minLength: 20,
          },
          severity: {
            type: 'integer',
            description:
              'What this costs the reader if it happens, 0 to 100. Not how often clauses like it appear.',
            minimum: 0,
            maximum: 100,
          },
          explanation: {
            type: 'string',
            description:
              'Two or three sentences, addressed to the reader as "you", saying what this sentence lets the other side do.',
            minLength: 40,
          },
          changesYourEconomicsUnilaterally: {
            type: 'boolean',
            description:
              'True when this clause lets the other side change what the reader earns, owes, owns or must do, on its own, after the reader has signed.',
          },
          bindsBothSidesEqually: {
            type: 'boolean',
            description:
              'True when the clause applies to both parties in the same way, such as a governing law or a notice address.',
          },
          textualAmbiguity: {
            type: 'boolean',
            description:
              "True only when the sentence's own wording carries two readings that differ in what the reader is agreeing to.",
          },
          harmConfidence: {
            type: 'string',
            description:
              'full when the sentence plainly does the harm described, partial when the reading is defensible but not certain.',
            enum: ['full', 'partial'],
          },
        },
        required: [
          'id',
          'clauseType',
          'sourceSentence',
          'severity',
          'explanation',
          'changesYourEconomicsUnilaterally',
          'bindsBothSidesEqually',
          'textualAmbiguity',
          'harmConfidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['flags'],
  additionalProperties: false,
};

interface FlagsOutput {
  flags: Array<Omit<ProposedFlag, 'band'>>;
}

const FLAGS_SYSTEM_PROMPT = [
  'You read an agreement on behalf of the person being asked to sign it, and list the clauses that could cost them.',
  '',
  'Quoting:',
  '- Every clause you list carries one sentence copied from the agreement, character for character.',
  '- Copy it. Do not tidy it, do not fix its punctuation or capitalisation, do not shorten it, do not join two sentences, do not translate it.',
  '- A quote that is not in the document is thrown away and the reader never sees that clause, so a copied sentence matters more than a neat one.',
  '- One sentence per clause. If the harm lives in two sentences, list the one that does the most of it.',
  '',
  'What to list:',
  '- A clause belongs in the list when it lets the other side change what the reader earns, owes, owns or has to do, on its own, after the reader has signed.',
  '- A clause that binds both sides in the same way does not belong in the list, however unusual it is. An odd governing law or an odd notice address is a deviation from a template, not a danger.',
  '- List a clause even when you are only partly sure it harms the reader. The reader has the sentence in front of them and can judge it.',
  '- Do not list a term the agreement is missing. Something absent has no sentence to quote.',
  '',
  'Severity is what the clause costs the reader if it happens, not how often clauses like it turn up. Rate the consequence.',
  '',
  'Writing:',
  '- Address the reader as "you" and the other side by the name the document uses.',
  '- Say only what the sentence says. Do not say what a court would do, what the law requires, or whether the clause is enforceable.',
  '- Write plainly. Do not hedge.',
].join('\n');

/** The prompt for the flag stage. Exported so a test can read what was sent. */
export function flagsRequest(text: string): StructuredRequest {
  return {
    name: 'document_flags',
    schema: flagsSchema,
    messages: [
      { role: 'system', content: FLAGS_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `List the clauses in the agreement below that could cost the reader.\n\n---\n${text}\n---`,
      },
    ],
  };
}

/**
 * What the model is asked for in the gap stage.
 *
 * There is no `sourceSentence` property, and `additionalProperties: false` means
 * a reply carrying one is refused rather than trimmed. That is ADR-0005 stated at
 * the boundary: a gap cannot even be described to the model as something with a
 * sentence attached.
 */
export const gapsSchema: ObjectSchema = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      description:
        'Every term this agreement should contain for the reader’s protection and does not.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'A short lowercase name for the missing term, words joined by hyphens, such as no-late-payment-term.',
            minLength: 2,
          },
          statement: {
            type: 'string',
            description:
              'One sentence about the whole agreement, saying what it does not contain, such as "This agreement contains no late-payment term." Never a quotation.',
            minLength: 20,
          },
          severity: {
            type: 'integer',
            description:
              'What this absence costs the reader if it bites, 0 to 100. Not how often agreements leave it out.',
            minimum: 0,
            maximum: 100,
          },
          explanation: {
            type: 'string',
            description:
              'Two or three sentences, addressed to the reader as "you", saying what the reader is exposed to because the agreement is silent here.',
            minLength: 40,
          },
        },
        required: ['id', 'statement', 'severity', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['gaps'],
  additionalProperties: false,
};

interface GapsOutput {
  gaps: Array<Omit<GapClaim, 'band'>>;
}

const GAPS_SYSTEM_PROMPT = [
  'You read an agreement on behalf of the person being asked to sign it, and list the terms it should contain for their protection and does not.',
  '',
  'What to list:',
  '- A term belongs in the list when the agreement is silent about it and that silence leaves the reader exposed: no deadline for payment, no ceiling on what the reader can be made to pay, no limit on revisions, no right to end the agreement.',
  '- Check the whole agreement before you say a term is absent. A term written somewhere other than where you expected it is present.',
  '- Do not list a clause that is in the agreement and is one-sided. Another stage handles what the document says; this one handles what it does not say.',
  '',
  'Writing:',
  '- Write each one as a single sentence about the whole agreement, starting "This agreement".',
  '- Do not quote the agreement, and do not repeat its wording. There is no sentence to quote, because the term is not there.',
  '- Address the reader as "you" in the explanation and name the other side the way the document does.',
  '- Say only what follows from the agreement being silent. Do not say what a court would do, what the law requires, or what the term should say instead.',
  '- Write plainly. Do not hedge.',
  '',
  'Severity is what the absence costs the reader if it bites, not how often agreements leave the term out.',
].join('\n');

/** The prompt for the gap stage. Exported so a test can read what was sent. */
export function gapsRequest(text: string): StructuredRequest {
  return {
    name: 'document_gaps',
    schema: gapsSchema,
    messages: [
      { role: 'system', content: GAPS_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `List the terms the agreement below should contain and does not.\n\n---\n${text}\n---`,
      },
    ],
  };
}

/**
 * Reads one document: a plain-English summary, the clauses that could cost the
 * reader, and the terms the agreement leaves out, each ranked by what it costs.
 *
 * Nothing reaches `flags` without its source sentence having been found in
 * `documentText` first, because `verifyFlags` is the only thing that makes the
 * type `flags` holds (ADR-0001). Gaps come back from their own stage and through
 * their own gate, `verifyGaps`, and the type they arrive as has no field a source
 * sentence could occupy (ADR-0005). The two lists stay separate here and are
 * interleaved by severity where the reader reads them.
 */
export async function analyzeDocument(
  text: string,
  redLines: string[],
  deps: AnalysisDeps,
): Promise<AnalysisResult> {
  // The reader's red lines override the plausibility filter and the confidence
  // threshold (ADR-0013). That override is its own slice of work; until it lands
  // the list is what the document itself supports, so the red lines are carried
  // but not consulted, and the summary never sees them at all.
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
  const proposed = await deps.model.complete<FlagsOutput>(
    flagsRequest(documentText),
  );
  const absent = await deps.model.complete<GapsOutput>(gapsRequest(documentText));

  // Plausibility first, so an unusual-but-symmetric clause is gone before
  // anything is ranked (ADR-0004); verification last, so what survives is
  // quoting the document rather than the model (ADR-0001).
  const dangerous = dangerousOnly(withIds(proposed.flags));
  const { flags, dropped } = verifyFlags(dangerous, documentText);
  for (const drop of dropped) {
    console.warn(
      'A flag was dropped because its source sentence is not in the document: %s (%s)',
      drop.id,
      drop.quoted,
    );
  }

  const { gaps, dropped: droppedGaps } = verifyGaps(
    withGapIds(absent.gaps),
    documentText,
  );
  for (const drop of droppedGaps) {
    console.warn(
      'A gap was dropped because %s: %s (%s)',
      drop.reason,
      drop.id,
      drop.claimed,
    );
  }

  return {
    summary: summary.trim(),
    flags: rankFlags(flags),
    gaps: rankGaps(gaps),
  };
}

/**
 * Gives each proposed flag its band and an id no other flag in the run shares,
 * so two readings of one clause can never collide in the list or in a key.
 */
function withIds(proposed: FlagsOutput['flags']): ProposedFlag[] {
  const naming = names('flag');
  return proposed.map((flag) => ({
    ...flag,
    id: naming(flag.id),
    band: bandFor(flag.severity),
  }));
}

/**
 * The same for gaps, in their own namespace: a flag and a gap sharing a name
 * would be two different claims under one id in the ranked list.
 */
function withGapIds(proposed: GapsOutput['gaps']): GapClaim[] {
  const naming = names('gap');
  return proposed.map((gap) => ({
    ...gap,
    id: naming(gap.id),
    band: bandFor(gap.severity),
  }));
}

/** Hands out ids, tidying what the model chose and refusing to repeat one. */
function names(kind: string): (proposed: string) => string {
  const taken = new Set<string>();
  let counted = 0;

  return (proposed: string) => {
    counted += 1;
    const base = proposed.trim().toLowerCase().replace(/\s+/g, '-') || `${kind}-${counted}`;
    let id = base;
    let suffix = 2;
    while (taken.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    taken.add(id);
    return id;
  };
}
