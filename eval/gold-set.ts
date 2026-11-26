/**
 * The gold set, read off disk the way `manifest.json` lays it out.
 *
 * The gold set is not kept in this repo. It lives in a folder of its own, by
 * default `redline-gold-set` beside the repo folder, or wherever
 * `EVAL_GOLD_SET_DIR` points. That folder holds `corpus/` and `fixtures/`, so the
 * relative paths inside the manifest still resolve from `corpus/`. Nothing here
 * rewrites a sentence: what is loaded is what the files say, down to the curly
 * quotes, ligatures and non-breaking spaces the corpus carries on purpose.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The seven clause types the gold set plants, by its own slugs. */
export const GOLD_CLAUSE_TYPES = [
  'arbitration-and-class-action-waiver',
  'unilateral-modification',
  'non-compete',
  'auto-renewal',
  'limitation-of-liability',
  'indemnification',
  'fee-escalators-and-late-fees',
] as const;

export type GoldClauseType = (typeof GOLD_CLAUSE_TYPES)[number];

export interface PlantedClause {
  id: string;
  clauseType: GoldClauseType;
  /** Verbatim from the document. Checked by `gold-set.test.ts`. */
  sourceSentence: string;
  expectedSeverityBand: 'critical' | 'high' | 'moderate';
  exit: { text: string; sourceSentence: string } | null;
}

interface Sidecar {
  document: string;
  title: string;
  checkedClauseTypes: GoldClauseType[];
  plantedClauses: PlantedClause[];
}

interface QuestionSet {
  document: string;
  grounded: Array<{ question: string; expectedSourceSentence: string }>;
  ungrounded: Array<{ question: string }>;
}

interface ManifestEntry {
  id: string;
  document: string;
  sidecar: string;
  questions?: string;
  provenance: string;
  benign: boolean;
  unusualButHarmless: string[];
}

export interface GoldDocument {
  id: string;
  /** Path from the gold set folder, for printing. */
  path: string;
  /** The file's text exactly as it is on disk. */
  text: string;
  title: string;
  benign: boolean;
  plantedClauses: PlantedClause[];
  /** Odd but costless sentences. A flag on one is an over-flag. */
  unusualButHarmless: string[];
  /** Every sentence a question set says answers one of its questions. */
  questionSentences: string[];
}

const evalDir = dirname(fileURLToPath(import.meta.url));

/** Where the gold set lives: `EVAL_GOLD_SET_DIR`, or `redline-gold-set` beside the repo. */
export const goldSetDir = resolve(
  process.env.EVAL_GOLD_SET_DIR?.trim() || join(evalDir, '..', '..', 'redline-gold-set'),
);
const corpusDir = join(goldSetDir, 'corpus');

/** Whether the gold set is on this machine. Its tests skip when it is not. */
export function goldSetAvailable(): boolean {
  return existsSync(join(corpusDir, 'manifest.json'));
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Every document in `manifest.json`, in manifest order. */
export function loadGoldSet(): GoldDocument[] {
  const manifest = readJson<{ documents: ManifestEntry[] }>(
    join(corpusDir, 'manifest.json'),
  );

  return manifest.documents.map((entry) => {
    const documentPath = join(corpusDir, entry.document);
    const sidecar = readJson<Sidecar>(join(corpusDir, entry.sidecar));
    const questions = entry.questions
      ? readJson<QuestionSet>(join(corpusDir, entry.questions))
      : null;

    return {
      id: entry.id,
      path: join('corpus', entry.document).replace(/\\/g, '/'),
      text: readFileSync(documentPath, 'utf8'),
      title: sidecar.title,
      benign: entry.benign,
      plantedClauses: sidecar.plantedClauses,
      unusualButHarmless: entry.unusualButHarmless,
      questionSentences:
        questions?.grounded.map((question) => question.expectedSourceSentence) ?? [],
    };
  });
}

/**
 * Every sentence the gold set claims is in a document, with where the claim was
 * made, so a failing check can say which one drifted.
 */
export function claimedSentences(
  document: GoldDocument,
): Array<{ where: string; sentence: string }> {
  return [
    ...document.plantedClauses.flatMap((clause) => [
      { where: `${clause.id} sourceSentence`, sentence: clause.sourceSentence },
      ...(clause.exit
        ? [{ where: `${clause.id} exit.sourceSentence`, sentence: clause.exit.sourceSentence }]
        : []),
    ]),
    ...document.unusualButHarmless.map((sentence, index) => ({
      where: `unusualButHarmless[${index}]`,
      sentence,
    })),
    ...document.questionSentences.map((sentence, index) => ({
      where: `questions grounded[${index}] expectedSourceSentence`,
      sentence,
    })),
  ];
}
