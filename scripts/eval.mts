/**
 * The eval run: every document in the gold set through the real analysis,
 * against the real model, scored against what the gold set says is in it.
 *
 * It reads each document exactly the way `npm run smoke` does: the text is
 * normalised with `normalizeDocumentText`, read with `analyzeDocument`, and the
 * model is `createOpenRouterClient()` with the settings in `.env.local`. No
 * prompt, model setting or filter is changed for the eval. The one addition is
 * a wrapper around the client that keeps a copy of every reply, because
 * groundedness is measured on what the model sent back, and the pipeline throws
 * away a flag whose quote it cannot find before anything downstream can see it.
 *
 * Like the smoke run it is not part of `npm test` and must never be wired into
 * it. `eval/gold-set.test.ts` is the part of this that runs on every commit.
 *
 * What the numbers mean, and every decision behind them, is in `eval/README.md`.
 * Run it with `npm run eval`.
 */

import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The same resolver the smoke run registers, for the same reason: `lib/` leaves
 * extensions off the way a bundler expects, and Node needs them filled back in.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.')) throw error;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // Try the next shape, then give up with the original error.
        }
      }
      throw error;
    }
  },
});

const { analyzeDocument, NOT_AN_AGREEMENT_REASON } = await import(
  '../lib/analysis/analyze-document'
);
const { AnalysisError } = await import('../lib/analysis/types');
const { normalizeDocumentText } = await import('../lib/document-text');
const { createOpenRouterClient } = await import('../lib/model/openrouter');
const { goldSetAvailable, goldSetDir, loadGoldSet } = await import('../eval/gold-set');
const { CLAUSE_TYPE_RULES, IN_SCOPE_TYPES, OUT_OF_SCOPE, formatCount, scoreRun } =
  await import('../eval/scoring');
import type { ModelClient, StructuredRequest } from '../lib/model/client';
import type { GoldDocument } from '../eval/gold-set';
import type { DocumentRun, RecordedFlag, Score } from '../eval/scoring';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runsDir = join(root, 'eval-runs');

async function main(): Promise<number> {
  const missing = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL'].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    console.log(
      `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set, so there is no model to call.`,
    );
    console.log(
      'The eval needs the real model. Scoring the test stub would measure the stub, so it stops here.',
    );
    return 1;
  }

  if (!goldSetAvailable()) {
    console.log(`No gold set at ${goldSetDir}. The gold set is not kept in this repo.`);
    console.log(
      'Put its corpus/ and fixtures/ folders there, or set EVAL_GOLD_SET_DIR in .env.local to where they are.',
    );
    return 1;
  }

  const startedAt = new Date();
  const model = process.env.OPENROUTER_MODEL as string;
  const documents = loadGoldSet();
  console.log(
    `Reading ${documents.length} gold-set documents with ${model} through OpenRouter, one at a time.`,
  );

  const runs: DocumentRun[] = [];
  for (const document of documents) {
    process.stdout.write(`  ${document.id} ... `);
    const result = await readOne(document);
    runs.push(result);
    console.log(
      result.outcome === 'failed'
        ? `failed: ${result.error}`
        : `${result.outcome}, ${result.shownFlags.length} flags shown of ${result.modelFlags.length} returned (${(result.durationMs / 1000).toFixed(0)}s)`,
    );
  }

  const score = scoreRun(runs);
  const report = render(score, runs, { startedAt, model });
  console.log('');
  console.log(report);

  const stamp = startedAt.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(join(runsDir, `${stamp}.txt`), `${report}\n`, 'utf8');
  writeFileSync(
    join(runsDir, `${stamp}.json`),
    `${JSON.stringify(record(score, runs, { startedAt, model }), null, 2)}\n`,
    'utf8',
  );
  console.log(`Saved eval-runs/${stamp}.txt and eval-runs/${stamp}.json`);
  // A run where every document was left out measured nothing, and says so.
  return score.documents.scored === 0 ? 1 : 0;
}

/**
 * One document through the pipeline. Red lines are empty: the gold set defines
 * none, so this is the read a visitor gets on the no-account try.
 */
async function readOne(document: GoldDocument): Promise<DocumentRun> {
  const started = Date.now();
  const replies = new Map<string, unknown>();
  const notes: string[] = [];
  const stopCollecting = collectWarnings(notes);
  const base = {
    document,
    notes,
    gapCount: 0,
    cleanRead: false,
    shownFlags: [] as RecordedFlag[],
  };

  try {
    const analysis = await analyzeDocument(
      normalizeDocumentText(document.text),
      [],
      { model: recording(createOpenRouterClient(), replies) },
    );
    return {
      ...base,
      outcome: 'completed',
      shownFlags: analysis.flags.map((flag) => ({
        id: flag.id,
        clauseType: flag.clauseType,
        severity: flag.severity,
        band: flag.band,
        sourceSentence: flag.sourceSentence,
      })),
      modelFlags: returnedFlags(replies),
      gapCount: analysis.gaps.length,
      cleanRead: analysis.cleanRead !== null,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    // The model read the text and answered that it is not an agreement. That
    // is the product's answer about this document, so it is scored as a read
    // that showed nothing, not as a call that failed.
    if (error instanceof AnalysisError && error.message === NOT_AN_AGREEMENT_REASON) {
      return {
        ...base,
        outcome: 'refused',
        error: error.message,
        modelFlags: [],
        durationMs: Date.now() - started,
      };
    }
    return {
      ...base,
      outcome: 'failed',
      error: error instanceof Error ? error.message : String(error),
      modelFlags: [],
      durationMs: Date.now() - started,
    };
  } finally {
    stopCollecting();
  }
}

/** The same client, keeping a copy of each reply under its request's name. */
function recording(client: ModelClient, into: Map<string, unknown>): ModelClient {
  return {
    async complete<T>(request: StructuredRequest): Promise<T> {
      const reply = await client.complete<T>(request);
      into.set(request.name, structuredClone(reply));
      return reply;
    },
  };
}

/** Every flag the flag stage sent back, before any filter or check. */
function returnedFlags(replies: Map<string, unknown>): RecordedFlag[] {
  const reply = replies.get('document_flags') as
    | { flags: Array<{ id: string; clauseType: string; severity: number; sourceSentence: string }> }
    | undefined;
  return (reply?.flags ?? []).map((flag) => ({
    id: flag.id,
    clauseType: flag.clauseType,
    severity: flag.severity,
    sourceSentence: flag.sourceSentence,
  }));
}

interface RunInfo {
  startedAt: Date;
  model: string;
}

function render(score: Score, runs: readonly DocumentRun[], info: RunInfo): string {
  const lines: string[] = [];
  const say = (line = '') => lines.push(line);
  const heading = (title: string) => {
    say();
    say(title.toUpperCase());
    say('-'.repeat(title.length));
  };

  say(`Redline eval run, started ${info.startedAt.toISOString()}`);
  say(`Model: ${info.model} through OpenRouter, settings from .env.local`);
  say('Gold set: kept outside the repo (written by a model, so every figure here is an upper bound)');

  heading('Documents');
  say(`  Scored: ${score.documents.scored} of ${score.documents.total}`);
  say(`  Left out because a model call failed: ${score.documents.leftOut.length}`);
  for (const left of score.documents.leftOut) say(`    - ${left.id}: ${left.error}`);
  for (const run of runs.filter((r) => r.outcome === 'refused')) {
    say(`  Refused as not an agreement (scored as zero flags): ${run.document.id}`);
  }
  if (score.documents.scored === 0) {
    say('  No document was scored, so every figure below is 0/0 and measures nothing.');
  }

  heading('Recall');
  say(`  Planted clauses found:              ${formatCount(score.recall)}`);
  say(`  Found and named the right type:     ${formatCount(score.recallWithType)}`);
  say('  In scope: ' + IN_SCOPE_TYPES.join(', '));
  say();
  say('  By type                               found            named right');
  for (const row of score.recallByType) {
    say(`    ${row.type.padEnd(34)} ${formatCount(row.found).padEnd(16)} ${formatCount(row.withType)}`);
  }
  say();
  say('  By the characters in the planted sentence');
  say(`    no special character               ${formatCount(score.recallByCharacters.plain)}`);
  say(`    at least one special character     ${formatCount(score.recallByCharacters.special)}`);
  for (const row of score.recallByCharacters.byClass) {
    say(`      ${row.label.padEnd(32)} ${formatCount(row.found)}`);
  }
  say();
  say('  Out of scope, never counted as a miss');
  for (const row of score.outOfScope) {
    say(`    ${row.type}: found anyway ${formatCount(row.foundAnyway)}`);
    say(`      ${row.reason}`);
  }

  heading('Groundedness');
  say(`  Returned flags quoting the document exactly:  ${formatCount(score.groundedness)}`);
  say(`  Same, against the file before normalisation:  ${formatCount(score.groundednessInFile)}`);
  say(`  Shown flags quoting the document exactly:     ${formatCount(score.shownGroundedness)}`);

  heading('Clean documents');
  say(`  Benign documents with no flags shown:  ${formatCount(score.clean.documents)}`);
  say(`  Flags shown on benign documents:       ${score.clean.flags}`);
  say(`  Benign documents given the clean read: ${formatCount(score.clean.cleanReads)}`);
  for (const row of score.clean.perDocument) {
    say(`    ${row.id}: ${row.flags} flags, ${row.gaps} gaps, ${row.cleanRead ? 'clean read' : 'no clean read'} (${row.outcome})`);
  }
  say(`  Unusual-but-harmless sentences flagged: ${formatCount(score.unusualButHarmlessFlagged)}`);

  heading('Planted clauses missed');
  const missed = score.planted.filter((clause) => clause.inScope && !clause.found);
  if (missed.length === 0) say(score.recall.of === 0 ? '  Nothing was scored.' : '  None.');
  for (const clause of missed) {
    say(`  ${clause.documentId} ${clause.id} ${clause.clauseType}`);
    say(`    "${clause.sourceSentence}"`);
  }

  heading('Every flag shown');
  for (const flag of score.shownFlags) {
    const matched = flag.matchedPlanted.length ? `matches ${flag.matchedPlanted.join(', ')}` : 'matches nothing planted';
    say(`  ${flag.documentId}  ${flag.severity} ${flag.band ?? ''}  ${flag.clauseType} -> ${flag.mappedType ?? 'unmapped'}  ${matched}`);
    say(`    "${flag.sourceSentence}"`);
  }

  heading('Returned flags whose quote is not in the document');
  const ungrounded = score.modelFlags.filter((flag) => !flag.grounded);
  if (ungrounded.length === 0) say('  None.');
  for (const flag of ungrounded) {
    say(`  ${flag.documentId}  ${flag.clauseType}`);
    say(`    "${flag.sourceSentence}"`);
  }

  heading('What the pipeline logged');
  for (const run of runs) {
    for (const note of run.notes) say(`  ${run.document.id}: ${note}`);
  }

  return lines.join('\n');
}

/** Everything the run saw, for the .json record. */
function record(score: Score, runs: readonly DocumentRun[], info: RunInfo) {
  const { planted, shownFlags, modelFlags, ...rates } = score;
  return {
    startedAt: info.startedAt.toISOString(),
    model: info.model,
    goldSet: 'gold set kept outside the repo (corpus and fixtures)',
    redLines: [],
    inScopeTypes: IN_SCOPE_TYPES,
    outOfScope: OUT_OF_SCOPE,
    clauseTypeRules: CLAUSE_TYPE_RULES.map(([type, pattern]) => ({ type, pattern: pattern.source })),
    rates,
    documents: runs.map((run) => ({
      id: run.document.id,
      outcome: run.outcome,
      ...(run.error ? { error: run.error } : {}),
      durationMs: run.durationMs,
      gaps: run.gapCount,
      cleanRead: run.cleanRead,
      notes: run.notes,
    })),
    planted,
    flags: shownFlags.map((flag) => ({
      document: flag.documentId,
      id: flag.id,
      clauseType: flag.clauseType,
      mappedType: flag.mappedType,
      severity: flag.severity,
      band: flag.band,
      sourceSentence: flag.sourceSentence,
      matchedPlanted: flag.matchedPlanted.length > 0,
      matchedPlantedIds: flag.matchedPlanted,
      onUnusualButHarmless: flag.onUnusualButHarmless,
    })),
    returnedFlags: modelFlags.map((flag) => ({
      document: flag.documentId,
      id: flag.id,
      clauseType: flag.clauseType,
      mappedType: flag.mappedType,
      severity: flag.severity,
      sourceSentence: flag.sourceSentence,
      grounded: flag.grounded,
      groundedInFile: flag.groundedInFile,
      matchedPlanted: flag.matchedPlanted.length > 0,
      matchedPlantedIds: flag.matchedPlanted,
    })),
  };
}

/** Gathers every warning the read writes, until the returned function is called. */
function collectWarnings(into: string[]): () => void {
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    into.push(formatWarning(args));
  };
  return () => {
    console.warn = warn;
  };
}

/** A `console.warn` call as one line, with its `%s` placeholders filled in. */
function formatWarning(args: readonly unknown[]): string {
  const [first, ...rest] = args;
  if (typeof first !== 'string') return args.map(String).join(' ');
  let index = 0;
  const filled = first.replace(/%s/g, () =>
    index < rest.length ? String(rest[index++]) : '%s',
  );
  return [filled, ...rest.slice(index).map(String)].join(' ');
}

try {
  process.exitCode = await main();
} catch (error) {
  console.log('');
  console.log(
    `The eval run stopped: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
