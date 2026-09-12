/**
 * The smoke run: one fixture agreement through the real analysis, against the
 * real model, printed for a person to read.
 *
 * This is the one place in the build that calls OpenRouter for real. Every test
 * stubs the model client, which means the suite proves the pipeline handles a
 * reply correctly and proves nothing about what a live model actually sends
 * back. ADR-0001 says a flag the reader sees carries a sentence that is in the
 * document. This script is where that claim is checked end to end, on a real
 * reply, by looking every printed source sentence up in the fixture text again.
 *
 * It is not part of `npm test` and must never be wired into it: a suite that
 * makes a network call is a suite that fails when the network does.
 *
 * The verification below is deliberately its own code rather than a call into
 * `lib/analysis/source-sentence`. Checking the pipeline with the pipeline's own
 * matcher would pass whether the matcher is right or wrong. A verified flag
 * carries a span cut out of the normalised document text, so plain string
 * containment is the honest test, and it is the one used here.
 *
 * Run it with `npm run smoke`.
 */

import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Node resolves ESM specifiers as written, and every import in `lib/` leaves the
 * extension off the way a bundler expects. This fills it back in, so the product
 * code can be run under Node's own type stripping without a build step or a
 * runner dependency. Nothing about the modules themselves changes.
 *
 * It has to be registered before any of them are loaded, which is why the
 * imports below are dynamic and this sits above them.
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

const { analyzeDocument } = await import('../lib/analysis/analyze-document');
const { draftCounterOffer } = await import('../lib/analysis/counter-offer');
const { normalizeDocumentText } = await import('../lib/document-text');
const { createOpenRouterClient } = await import('../lib/model/openrouter');
const { SEVERITY_THRESHOLD } = await import('../lib/analysis/ranking');
import type { ClauseToRewrite } from '../lib/analysis/counter-offer';
import type { VerifiedFlag } from '../lib/analysis/verified-flag';
import type { FixtureSidecar } from '../tests/fixtures';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = join(root, 'tests', 'fixtures');
const WIDTH = 78;

async function main(): Promise<number> {
  const missing = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL'].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    console.log(
      `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set, so there is no model to call.`,
    );
    console.log(
      'The smoke run needs the real model. Running it against the test stub would prove nothing, so it stops here.',
    );
    console.log(
      `Put ${missing.length === 1 ? 'it' : 'them'} in .env.local and run it again.`,
    );
    return 1;
  }

  const sidecar = JSON.parse(
    readFileSync(join(fixtureDir, 'adhesion-agreement.json'), 'utf8'),
  ) as FixtureSidecar;
  const raw = readFileSync(join(fixtureDir, sidecar.textFile), 'utf8');

  // The same normalisation the analysis runs on the way in, so the text checked
  // against here is the text the flags were cut out of.
  const documentText = normalizeDocumentText(raw);

  heading('The document');
  console.log(
    `  ${relative(root, join(fixtureDir, sidecar.textFile)).replace(/\\/g, '/')}`,
  );
  console.log(`  ${documentText.length} characters, ${sidecar.name}`);
  console.log('');
  console.log("  Read against the reader's red lines:");
  for (const redLine of sidecar.redLines) console.log(`    - ${redLine}`);
  console.log('');
  console.log(
    `  Calling ${process.env.OPENROUTER_MODEL} through OpenRouter. These are real calls, so give it a moment.`,
  );

  // What the read drops, it writes to the warning log and nowhere else, so the
  // log is where the count of dropped findings has to come from. Collected
  // rather than silenced: every line of it is printed further down, and the
  // capture stays on through the drafting call, which drops things of its own.
  const notes: string[] = [];
  const stopCollecting = collectWarnings(notes);
  try {
    return await report(documentText, sidecar, notes);
  } finally {
    stopCollecting();
  }
}

/** The read itself, and everything printed from it. Returns the exit code. */
async function report(
  documentText: string,
  sidecar: FixtureSidecar,
  notes: string[],
): Promise<number> {
  const analysis = await analyzeDocument(documentText, sidecar.redLines, {
    model: createOpenRouterClient(),
  });

  heading('Summary');
  console.log(indent(analysis.summary));

  const redLineFor = new Map(
    analysis.redLineMatches.map((match) => [match.flagId, match.redLine]),
  );

  let verified = 0;

  if (analysis.cleanRead) {
    heading('A clean read');
    console.log(
      indent(
        `A finished read found nothing in this agreement at or above severity ${analysis.cleanRead.threshold}.`,
      ),
    );
  }

  heading(`Flags (${analysis.flags.length})`);
  if (analysis.flags.length === 0) {
    console.log('  None.');
  }
  analysis.flags.forEach((flag, index) => {
    const found = documentText.includes(flag.sourceSentence);
    if (found) verified += 1;

    const redLine = redLineFor.get(flag.id);
    console.log(
      `  ${index + 1}. ${flag.band.toUpperCase()} ${flag.severity}  ${flag.clauseType}  [${flag.id}]`,
    );
    if (redLine) console.log(indent(`Caught by a red line: ${redLine}`, 5));
    console.log(indent(wording(flag), 5));
    console.log(
      indent(
        `${found ? 'Source sentence, found in the document' : 'SOURCE SENTENCE NOT IN THE DOCUMENT'}:`,
        5,
      ),
    );
    console.log(indent(`"${flag.sourceSentence}"`, 7));
    console.log('');
  });

  heading(`Gaps (${analysis.gaps.length})`);
  if (analysis.gaps.length === 0) {
    console.log('  None.');
  }
  analysis.gaps.forEach((gap, index) => {
    console.log(
      `  ${index + 1}. ${gap.band.toUpperCase()} ${gap.severity}  [${gap.id}]`,
    );
    console.log(indent(gap.statement, 5));
    console.log(indent(gap.explanation, 5));
    console.log('');
  });

  // The worst flag only, and never a gap: a gap has no sentence to rewrite, and
  // `draftCounterOffer` will not take one (ADR-0014). Flags come back ranked, so
  // the first is the one to draft for.
  const worst = analysis.flags[0] as ClauseToRewrite | undefined;
  heading('Counter-offer, soft stance');
  if (!worst) {
    console.log('  Nothing was flagged, so there was nothing to draft against.');
  } else {
    console.log(
      `  Drafted for ${worst.id}, the worst flag at severity ${worst.severity}.`,
    );
    console.log('');
    const draft = await draftCounterOffer(worst, 'soft', {
      model: createOpenRouterClient(),
    });
    console.log(
      draft
        ? indent(draft.text)
        : indent(
            'The draft came back about a different sentence, so it was dropped. The flag stands on its own.',
          ),
    );
  }

  if (notes.length > 0) {
    heading('What the read dropped, and what the judge said');
    for (const note of notes) console.log(indent(note));
  }

  const dropped = notes.filter((note) => note.includes('was dropped')).length;
  heading('Tally');
  console.log(`  Flags shown to the reader: ${analysis.flags.length}`);
  console.log(`  Source sentences found in the document: ${verified}`);
  console.log(`  Findings dropped during the read: ${dropped}`);
  console.log(`  Severity threshold: ${SEVERITY_THRESHOLD}`);
  console.log('');

  const missed = analysis.flags.length - verified;
  if (missed === 0) {
    console.log('  Every flag above quotes the document. ADR-0001 holds.');
    return 0;
  }
  console.log(
    `  ${missed} of them quote wording the document does not contain, which is a bug in the pipeline.`,
  );
  return 1;
}

/** What the reader is shown for this flag: the hedge where there is one. */
function wording(flag: VerifiedFlag): string {
  if (!flag.ambiguity) return flag.explanation;
  return [
    flag.explanation,
    `Reads two ways: ${flag.ambiguity.hedge}`,
    `  One: ${flag.ambiguity.readings[0]}`,
    `  Or: ${flag.ambiguity.readings[1]}`,
  ].join('\n');
}

function heading(title: string): void {
  console.log('');
  console.log(title.toUpperCase());
  console.log('-'.repeat(title.length));
}

/** Wraps to the terminal and indents, so long paragraphs stay readable. */
function indent(text: string, by = 2): string {
  const pad = ' '.repeat(by);
  return text
    .split('\n')
    .flatMap((paragraph) => wrap(paragraph, WIDTH - by))
    .map((line) => `${pad}${line}`)
    .join('\n');
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line.length === 0) {
      line = word;
    } else if (line.length + word.length + 1 <= width) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
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
    `The smoke run stopped: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
