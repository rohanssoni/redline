import { describe, expect, it } from 'vitest';
import { goldSetAvailable, loadGoldSet, type GoldDocument } from './gold-set';
import {
  characterClassesIn,
  formatCount,
  mapClauseType,
  scoreRun,
  type DocumentRun,
  type RecordedFlag,
} from './scoring';

function run(
  document: GoldDocument,
  shownFlags: RecordedFlag[],
  overrides: Partial<DocumentRun> = {},
): DocumentRun {
  return {
    document,
    outcome: 'completed',
    shownFlags,
    modelFlags: shownFlags,
    gapCount: 0,
    cleanRead: shownFlags.length === 0,
    notes: [],
    durationMs: 0,
    ...overrides,
  };
}

function flag(sourceSentence: string, clauseType: string): RecordedFlag {
  return { id: clauseType.replace(/\s+/g, '-'), clauseType, severity: 80, sourceSentence };
}

// The gold set lives outside the repo. Without it, the tests that score real
// gold-set documents are skipped, and the rest still run.
const available = goldSetAvailable();
const documents = available ? loadGoldSet() : [];
const saas = documents.find((document) => document.id === 'saas-subscription')!;
const swim = documents.find((document) => document.id === 'swim-lesson-registration')!;

describe('mapClauseType', () => {
  it.each([
    ['unilateral price increase', 'fee-escalators-and-late-fees'],
    ['late payment interest', 'fee-escalators-and-late-fees'],
    ['unilateral terms amendment', 'unilateral-modification'],
    ['unilateral scope change', 'unilateral-modification'],
    ['automatic renewal', 'auto-renewal'],
    ['post-termination non-compete', 'non-compete'],
    ['employee non-solicitation', 'non-compete'],
    ['liability cap', 'limitation-of-liability'],
    ['uncapped indemnity', 'indemnification'],
    ['mandatory individual arbitration', 'arbitration-and-class-action-waiver'],
  ])('maps "%s" to %s', (productType, goldType) => {
    expect(mapClauseType(productType)).toBe(goldType);
  });

  it('maps a type it has no rule for to nothing', () => {
    expect(mapClauseType('portfolio restriction')).toBeNull();
  });
});

describe('characterClassesIn', () => {
  it('names every class a sentence carries', () => {
    expect(characterClassesIn('Meridian’s cap — ﬁnal, and  so on')).toEqual([
      'curly-quote',
      'non-breaking-space',
      'ligature',
      'em-dash',
      'double-space',
    ]);
    expect(characterClassesIn('Plain ASCII only.')).toEqual([]);
  });
});

describe.skipIf(!available)('scoreRun', () => {
  const p05 = saas?.plantedClauses.find((clause) => clause.id === 'P-05')!;
  const p08 = saas?.plantedClauses.find((clause) => clause.id === 'P-08')!;

  it('counts a planted clause as found when a flag overlaps its sentence, and checks the type apart', () => {
    // A quote of only the first half of the sentence still overlaps it.
    const half = p05.sourceSentence.slice(0, 60);
    const score = scoreRun([run(saas, [flag(half, 'fee schedule change')])]);

    const scored = score.planted.find((clause) => clause.id === 'P-05')!;
    expect(scored.found).toBe(true);
    expect(scored.typeMatched).toBe(false);
    expect(score.recall.count).toBe(1);
    expect(score.recallWithType.count).toBe(0);
  });

  it('never counts an out-of-scope type in recall', () => {
    const score = scoreRun([run(saas, [])]);
    const inScope = saas.plantedClauses.filter(
      (clause) => clause.clauseType !== 'arbitration-and-class-action-waiver',
    );
    expect(score.recall).toEqual({ count: 0, of: inScope.length });
    expect(score.planted.find((clause) => clause.id === p08.id)!.inScope).toBe(false);
  });

  it('leaves a failed document out of every denominator', () => {
    const score = scoreRun([
      run(saas, [], { outcome: 'failed', error: 'OpenRouter refused document_flags' }),
      run(swim, []),
    ]);
    expect(score.documents.scored).toBe(1);
    expect(score.documents.leftOut).toEqual([
      { id: 'saas-subscription', error: 'OpenRouter refused document_flags' },
    ]);
    expect(score.recall.of).toBe(0);
    expect(score.clean.documents).toEqual({ count: 1, of: 1 });
  });

  it('scores groundedness on every flag the model returned, against the text the pipeline reads', () => {
    const retyped = p05.sourceSentence.replace('at any time', 'at any point');
    const score = scoreRun([
      run(saas, [flag(p05.sourceSentence, 'terms amendment')], {
        modelFlags: [
          flag(p05.sourceSentence, 'terms amendment'),
          flag(retyped, 'terms amendment'),
        ],
      }),
    ]);
    expect(score.groundedness).toEqual({ count: 1, of: 2 });
    expect(score.shownGroundedness).toEqual({ count: 1, of: 1 });
  });

  it('counts flags on a benign document', () => {
    const sentence = swim.text.split('\n').find((line) => line.length > 80)!;
    const score = scoreRun([run(swim, [flag(sentence, 'refund policy')])]);
    expect(score.clean.flags).toBe(1);
    expect(score.clean.documents).toEqual({ count: 0, of: 1 });
  });
});

describe('formatCount', () => {
  it('prints a count and a percentage', () => {
    expect(formatCount({ count: 3, of: 8 })).toBe('3/8 (37.5%)');
    expect(formatCount({ count: 0, of: 0 })).toBe('0/0 (n/a)');
  });
});
