import type { ObjectSchema } from '../model/json-schema';
import type { StructuredRequest } from '../model/client';
import {
  MINIMUM_READABLE_CHARACTERS,
  normalizeDocumentText,
  readableCharacterCount,
} from '../document-text';
import { AnalysisError, type AnalysisDeps, type AnalysisResult } from './types';
import { cleanReadFor } from './clean-read';
import { aboveThreshold, bandFor, dangerousOnly, rankGaps } from './ranking';
import { settleWording } from './hedging';
import { verifyGaps, type GapClaim } from './gap';
import { applyRedLineOverride } from './red-line-override';
import { reviewRedLineMatches } from './red-line-judge';
import { verifyFlags, type Flag, type ProposedFlag } from './verified-flag';

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
          alternativeReadings: {
            type: 'array',
            description:
              'The two readings, each one sentence, when textualAmbiguity is true. Empty when it is false.',
            items: { type: 'string' },
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
          'alternativeReadings',
          'harmConfidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['flags'],
  additionalProperties: false,
};

/**
 * One flag as the model sends it, which is not yet a `ProposedFlag`: the two
 * readings arrive beside the explanation, and `settleWording` turns them into the
 * hedge the reader sees, or into nothing (ADR-0010, ADR-0022).
 */
type FlagOutput = Omit<ProposedFlag, 'band' | 'ambiguity'> & {
  alternativeReadings: string[];
};

interface FlagsOutput {
  flags: FlagOutput[];
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
  'Two separate things you are asked about each clause, which are not the same question:',
  '- harmConfidence is how sure you are that this clause costs the reader. Partial is fine and changes nothing about how you write.',
  '- textualAmbiguity is about the sentence on the page and nothing else. Set it true only when the words themselves carry two readings that differ in what the reader is agreeing to, and a reader could see both by reading the sentence again.',
  '- When textualAmbiguity is true, put both readings in alternativeReadings, one sentence each, plainly worded: what the sentence means read the first way, and what it means read the second.',
  '- When it is false, leave alternativeReadings empty. Being unsure whether a clause holds up, whether a court would allow it, or what happens in practice is not ambiguity in the sentence. Those clauses are written plainly like any other.',
  '',
  'Writing:',
  '- Address the reader as "you" and the other side by the name the document uses.',
  '- Say only what the sentence says. Do not say what a court would do, what the law requires, or whether the clause is enforceable.',
  '- Write plainly. Do not hedge, including where you set textualAmbiguity: the two readings carry that, and Redline writes what the reader is shown.',
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
 * What the model is asked for in the red line stage.
 *
 * The same fields a flag carries, because what comes back is a flag — the reader
 * is shown no difference — plus the one thing that stage knows and the flag
 * stage does not: which of the reader's red lines the clause violates.
 *
 * There is no `changesYourEconomicsUnilaterally` and no `bindsBothSidesEqually`.
 * Those two exist to feed ADR-0004's plausibility filter, and a red line match
 * does not go through it (ADR-0013), so asking for them would be asking the model
 * for an answer nothing reads.
 */
export const redLineMatchesSchema: ObjectSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      description:
        'Every clause in this agreement that violates one of the reader’s red lines.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'A short lowercase name for the clause, words joined by hyphens, such as no-portfolio-use.',
            minLength: 2,
          },
          redLine: {
            type: 'string',
            description:
              'The red line this clause violates, copied from the reader’s list character for character.',
            minLength: 1,
          },
          clauseType: {
            type: 'string',
            description:
              'What kind of clause this is, in three or four plain words, such as "portfolio restriction".',
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
          textualAmbiguity: {
            type: 'boolean',
            description:
              "True only when the sentence's own wording carries two readings that differ in what the reader is agreeing to.",
          },
          alternativeReadings: {
            type: 'array',
            description:
              'The two readings, each one sentence, when textualAmbiguity is true. Empty when it is false.',
            items: { type: 'string' },
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
          'redLine',
          'clauseType',
          'sourceSentence',
          'severity',
          'explanation',
          'textualAmbiguity',
          'alternativeReadings',
          'harmConfidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['matches'],
  additionalProperties: false,
};

/** One red line match as the model sends it, before its wording is settled. */
type RedLineMatchOutput = Omit<Flag, 'band' | 'ambiguity'> & {
  redLine: string;
  alternativeReadings: string[];
};

interface RedLineMatchesOutput {
  matches: RedLineMatchOutput[];
}

const RED_LINE_SYSTEM_PROMPT = [
  'The reader has written down the terms they will not accept. You are given that list and an agreement, and you find the clauses in the agreement that break one of them.',
  '',
  'Matching:',
  '- What the clause does to the reader is the test. The reader wrote their list in their own words and a client’s contract will not use them, so shared wording proves nothing either way.',
  '- A clause breaks a red line when signing it means giving up the thing the red line says the reader keeps, whatever wording it arrives in.',
  '- A clause that leaves the reader’s stated line intact is not a match, and an agreement that breaks none of the lines returns an empty list.',
  '- One entry per clause and red line. Name the red line by copying it from the list, word for word.',
  '',
  'Quoting:',
  '- Every clause you list carries one sentence copied from the agreement, character for character.',
  '- Copy it. Do not tidy it, do not fix its punctuation or capitalisation, do not shorten it, do not join two sentences, do not translate it.',
  '- A quote that is not in the document is thrown away and the reader never sees that clause, so a copied sentence matters more than a neat one.',
  '',
  'Judging:',
  '- List the clause even when it looks minor, reads as even-handed, or is how most agreements are drafted. The reader has already decided this one matters to them, and that decision is not yours to review.',
  '- Severity is still what the clause costs the reader if it happens, rated the same way you would rate any other clause.',
  '',
  'Writing:',
  '- Address the reader as "you" and the other side by the name the document uses.',
  '- Say only what the sentence says. Do not mention the red line, do not say the reader asked for this, and do not say what a court would do.',
  '- Write plainly. Do not hedge, and do not soften a clause because it is a common one.',
  '- textualAmbiguity is about the sentence on the page and nothing else: set it true only when the words themselves carry two readings that differ in what the reader is agreeing to, and put both readings in alternativeReadings. Otherwise leave it false and the list empty.',
].join('\n');

/** The prompt for the red line stage. Exported so a test can read what was sent. */
export function redLineMatchesRequest(
  text: string,
  redLines: readonly string[],
): StructuredRequest {
  const list = redLines.map((redLine) => `- ${redLine}`).join('\n');
  return {
    name: 'red_line_matches',
    schema: redLineMatchesSchema,
    messages: [
      { role: 'system', content: RED_LINE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `The reader will not accept these terms:\n\n${list}\n\nList the clauses in the agreement below that break one of them.\n\n---\n${text}\n---`,
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
 *
 * The reader's red lines get a stage of their own, which runs last and only when
 * they wrote any. What it finds skips the plausibility filter and the severity
 * threshold and goes through the same citation gate as everything else
 * (ADR-0013), which is why it is verified by the same function rather than a
 * gentler one. The summary never sees the red lines: it says what the document
 * says, and whose priorities were brought to it changes nothing about that.
 *
 * Each of those matches is then reviewed by a judge of its own — a second model
 * call (ADR-0018) — which runs after everything the reader sees has been decided
 * and writes to a log, never to the result. What the judge says is a signal about
 * the matcher for a later audit, and a reader whose red line was caught sees the
 * same flag whether it agreed, disagreed or never answered (ADR-0019).
 */
export async function analyzeDocument(
  text: string,
  redLines: string[],
  deps: AnalysisDeps,
): Promise<AnalysisResult> {
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
  const stated = redLines.map((redLine) => redLine.trim()).filter(Boolean);
  const matched = stated.length
    ? await deps.model.complete<RedLineMatchesOutput>(
        redLineMatchesRequest(documentText, stated),
      )
    : { matches: [] };

  // One namespace across both stages: a flag and a red line match naming the
  // same clause would otherwise arrive as two findings under one id.
  const naming = names('flag');

  // Plausibility first, so an unusual-but-symmetric clause is gone before
  // anything is ranked (ADR-0004); verification last, so what survives is
  // quoting the document rather than the model (ADR-0001).
  const dangerous = dangerousOnly(withIds(proposed.flags, naming));

  // Between the filter and the citation check, because what a flag is allowed to
  // say is decided before its sentence is looked up and after it is known to be
  // worth showing at all (ADR-0010).
  const worded = settleFlagWording(dangerous);

  const flagCheck = verifyFlags(worded, documentText);
  const { dropped } = flagCheck;
  for (const drop of dropped) {
    console.warn(
      'A flag was dropped because its source sentence is not in the document: %s (%s)',
      drop.id,
      drop.quoted,
    );
  }

  // No `dangerousOnly` on this line and no threshold below it, which is the
  // whole of the override (ADR-0013). `verifyFlags` is the same call the flag
  // stage makes, on purpose: the citation gate is not part of what a red line
  // overrides, and there is no second version of it that would let one through.
  const claimedMatches = settleFlagWording(
    redLineMatchesWithIds(matched.matches, stated, naming),
  );
  const redLineCheck = verifyFlags(claimedMatches, documentText);
  for (const drop of redLineCheck.dropped) {
    console.warn(
      'A red line match was dropped because its source sentence is not in the document: %s (%s)',
      drop.id,
      drop.quoted,
    );
  }

  // Keyed on what came back from the gate, so a match whose sentence was not
  // found leaves no mark for a flag to inherit.
  const redLineBySentence = new Map<string, string>();
  for (const match of redLineCheck.flags) {
    const redLine = claimedMatches.find((claim) => claim.id === match.id)?.redLine;
    if (redLine !== undefined) {
      redLineBySentence.set(match.sourceSentence, redLine);
    }
  }

  const { flags, redLineMatches } = applyRedLineOverride(
    [...flagCheck.flags, ...redLineCheck.flags],
    redLineBySentence,
  );

  // After the override, and nothing below this line reads what it returns. The
  // judge is a second model's opinion of the matcher (ADR-0018), so it arrives
  // once the flags are already settled and is written to a log the reader has no
  // path to (ADR-0019). Awaited rather than left running, so a run that finished
  // has a complete log behind it, and it cannot throw, so a judge that is down
  // costs the reader nothing.
  await reviewRedLineMatches(redLineMatches, {
    model: deps.model,
    judgeLog: deps.judgeLog,
  });

  const gapCheck = verifyGaps(withGapIds(absent.gaps), documentText);
  const { gaps, dropped: droppedGaps } = gapCheck;
  for (const drop of droppedGaps) {
    console.warn(
      'A gap was dropped because %s: %s (%s)',
      drop.reason,
      drop.id,
      drop.claimed,
    );
  }

  // Reached only once all three stages have returned, which is what makes the
  // clean read below a statement about the document rather than about the run.
  const cleanRead = cleanReadFor({
    summary: summary.trim(),
    flagCheck,
    gapCheck,
    // The flags after the override, so a clause a red line put through below the
    // threshold is something the reader has to work through rather than a
    // document Redline calls clean (ADR-0008, ADR-0013).
    shownFlags: flags,
  });
  recordZeroFlagRate(cleanRead !== null);

  return {
    summary: summary.trim(),
    flags,
    gaps: rankGaps(aboveThreshold(gaps)),
    cleanRead,
    redLineMatches,
    // Nothing is drafted here. Reading a document and drafting replacement
    // language for a clause are separate pieces of work: `draftCounterOffer` is
    // its own seam, called once per flag by `readDocument` for a signed-in
    // reader, and a visitor's one anonymous try gets the summary and the flags
    // with no drafting call behind them at all.
    counterOffers: [],
  };
}

/**
 * The zero-flag rate, the production health metric ADR-0008 asks for, written
 * where the platform already collects logs.
 *
 * Nothing else in the product would surface a severity filter that has started
 * suppressing too hard: the symptom is documents quietly coming back with
 * nothing in them, and a rate is the only thing that shows it. One line per
 * finished read is enough to count both sides of that ratio. The baseline it is
 * compared against is not decided here, and ADR-0008 says so.
 */
function recordZeroFlagRate(wasCleanRead: boolean): void {
  console.info('redline.analysis.completed cleanRead=%s', wasCleanRead);
}

/**
 * Gives each proposed flag its band and an id no other flag in the run shares,
 * so two readings of one clause can never collide in the list or in a key.
 */
function withIds(
  proposed: FlagsOutput['flags'],
  naming: (proposed: string) => string,
): Array<ProposedFlag & { alternativeReadings: string[] }> {
  return proposed.map((flag) => ({
    ...flag,
    id: naming(flag.id),
    band: bandFor(flag.severity),
  }));
}

/**
 * The same for red line matches, and one thing more: a match naming a red line
 * the reader did not write is dropped here.
 *
 * The override exists to carry the reader's own list past the filters, so the
 * list is what it has to be checked against. A match citing wording that is not
 * in it is not the reader's decision being honoured, it is the model routing a
 * clause of its own choosing around ADR-0004.
 */
function redLineMatchesWithIds(
  matches: readonly RedLineMatchOutput[],
  stated: readonly string[],
  naming: (proposed: string) => string,
): Array<Flag & { redLine: string; alternativeReadings: string[] }> {
  const kept: Array<Flag & { redLine: string; alternativeReadings: string[] }> = [];

  for (const match of matches) {
    const redLine = stated.find(
      (written) => written.toLowerCase() === match.redLine.trim().toLowerCase(),
    );
    if (redLine === undefined) {
      console.warn(
        'A red line match was dropped because it names no red line the reader wrote: %s (%s)',
        match.id,
        match.redLine,
      );
      continue;
    }

    kept.push({
      ...match,
      redLine,
      id: naming(match.id),
      band: bandFor(match.severity),
    });
  }

  return kept;
}

/**
 * Settles what each flag is allowed to say before anything is shown: a hedge only
 * where the source sentence genuinely reads two ways and both readings came back
 * with it, and plain wording everywhere else (ADR-0010, ADR-0022).
 *
 * A flag whose every sentence hedged about something outside the document — how a
 * court would treat it, whether it holds up — has nothing left to tell the reader
 * once that is taken out, so it goes, and the reason is logged.
 */
function settleFlagWording<T extends Flag & { alternativeReadings: string[] }>(
  flags: readonly T[],
): T[] {
  const settled: T[] = [];

  for (const flag of flags) {
    const wording = settleWording({
      explanation: flag.explanation,
      textualAmbiguity: flag.textualAmbiguity,
      alternativeReadings: flag.alternativeReadings,
    });

    if (!wording) {
      console.warn(
        'A flag was dropped because nothing was left of its reading once the unverifiable hedging came out: %s',
        flag.id,
      );
      continue;
    }

    for (const struck of wording.struck) {
      console.warn(
        'A hedge the reader could not have checked was taken out of %s: %s',
        flag.id,
        struck,
      );
    }

    settled.push({
      ...flag,
      explanation: wording.explanation,
      textualAmbiguity: wording.textualAmbiguity,
      ...(wording.ambiguity ? { ambiguity: wording.ambiguity } : {}),
    } as T);
  }

  return settled;
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
