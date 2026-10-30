/**
 * How a run over the gold set is scored. No model and no network: everything
 * here takes what a run already produced and counts it, so the rules can be
 * tested on their own and read in one place.
 *
 * The decisions behind each rule, and the reasons for them, are in
 * `eval/README.md`. This file is what carries them out.
 */

import { normalizeDocumentText } from '../lib/document-text';
import {
  GOLD_CLAUSE_TYPES,
  type GoldClauseType,
  type GoldDocument,
  type PlantedClause,
} from './gold-set';

/**
 * Gold-set types this product does not flag, and why. A planted clause of one
 * of these types is never counted as a miss.
 */
export const OUT_OF_SCOPE: Partial<Record<GoldClauseType, string>> = {
  'arbitration-and-class-action-waiver':
    'Moves no money and no obligation, so it fails the ADR-0004 test PRD.md uses for a flag, and every gold-set instance sends a dispute to arbitration whichever side brings it, the symmetric shape PRD.md says to drop.',
};

export const IN_SCOPE_TYPES: GoldClauseType[] = GOLD_CLAUSE_TYPES.filter(
  (type) => !(type in OUT_OF_SCOPE),
);

/**
 * This product's clause types are free text, three or four words the model
 * chooses ("unilateral scope change"). Each is mapped onto a gold-set type by
 * the first rule it matches, in this order. The order matters: "uncapped
 * indemnity" has to reach indemnification before "cap" can say liability, and a
 * "fee" that is part of "amend the fee schedule" is still a modification.
 */
export const CLAUSE_TYPE_RULES: ReadonlyArray<readonly [GoldClauseType, RegExp]> = [
  ['arbitration-and-class-action-waiver', /arbitrat|class[- ]action|jury|right to sue|court waiver/],
  ['indemnification', /indemn|hold harmless|defend/],
  ['limitation-of-liability', /liabilit|damages cap|recovery cap|cap on (damages|recovery|claims)|limited (recovery|remedies)/],
  ['non-compete', /compet|solicit|restrictive covenant|restraint of trade|exclusiv/],
  ['auto-renewal', /renew|roll[- ]?over|evergreen|automatic (extension|continuation)|term extension/],
  ['unilateral-modification', /amend|modif|terms change|change (to|of) (the )?terms|unilateral (scope|terms|change)|scope change|rewrite|variation/],
  ['fee-escalators-and-late-fees', /fee|pric|\brates?\b|interest|\blate\b|charge|escalat|surcharge|tuition|dues|penalt|payment/],
];

/** The gold-set type a product clause type maps onto, or `null` for none. */
export function mapClauseType(productType: string): GoldClauseType | null {
  const lowered = productType.toLowerCase();
  for (const [goldType, pattern] of CLAUSE_TYPE_RULES) {
    if (pattern.test(lowered)) return goldType;
  }
  return null;
}

/**
 * The characters a model tends to retype instead of copying. A planted sentence
 * can carry more than one.
 */
export const CHARACTER_CLASSES = [
  { id: 'curly-quote', label: 'curly quote or apostrophe', pattern: /[‘’“”]/ },
  { id: 'non-breaking-space', label: 'non-breaking space', pattern: /[  ]/ },
  { id: 'ligature', label: 'fi or fl ligature', pattern: /[ﬁﬂ]/ },
  { id: 'em-dash', label: 'em dash', pattern: /—/ },
  { id: 'double-space', label: 'two spaces in a row', pattern: / {2}/ },
] as const;

export function characterClassesIn(sentence: string): string[] {
  return CHARACTER_CLASSES.filter((cls) => cls.pattern.test(sentence)).map(
    (cls) => cls.id,
  );
}

type Span = readonly [start: number, end: number];

/** Every place `needle` occurs in `haystack`, as half-open spans. */
export function spansOf(haystack: string, needle: string): Span[] {
  const spans: Span[] = [];
  if (needle.length === 0) return spans;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return spans;
    spans.push([at, at + needle.length]);
    from = at + 1;
  }
}

function overlapsAny(a: readonly Span[], b: readonly Span[]): boolean {
  return a.some(([aStart, aEnd]) =>
    b.some(([bStart, bEnd]) => aStart < bEnd && bStart < aEnd),
  );
}

/** One flag as a run recorded it, before it is scored. */
export interface RecordedFlag {
  id: string;
  clauseType: string;
  severity: number;
  band?: string;
  sourceSentence: string;
}

/** What happened to one document. */
export interface DocumentRun {
  document: GoldDocument;
  /**
   * `completed`: every stage answered. `refused`: the model answered that the
   * text is not an agreement, which is the product's answer and scored as zero
   * flags. `failed`: a model call did not come back usable, and the document is
   * left out of every denominator.
   */
  outcome: 'completed' | 'refused' | 'failed';
  error?: string;
  /** What the reader would be shown, after every filter and the citation check. */
  shownFlags: RecordedFlag[];
  /** Every flag the flag stage sent back, before anything was filtered. */
  modelFlags: RecordedFlag[];
  gapCount: number;
  cleanRead: boolean;
  /** What the pipeline logged while reading this document. */
  notes: string[];
  durationMs: number;
}

export interface ScoredFlag {
  documentId: string;
  id: string;
  clauseType: string;
  mappedType: GoldClauseType | null;
  severity: number;
  band?: string;
  sourceSentence: string;
  /** Exactly in the document text the pipeline checks against (ADR-0021). */
  grounded: boolean;
  /** Exactly in the file on disk, before normalisation. Stricter. */
  groundedInFile: boolean;
  /** Planted clauses whose sentence this flag's sentence overlaps. */
  matchedPlanted: string[];
  /** True when it overlaps a sentence the gold set calls unusual but harmless. */
  onUnusualButHarmless: boolean;
}

export interface ScoredPlanted {
  documentId: string;
  id: string;
  clauseType: GoldClauseType;
  inScope: boolean;
  sourceSentence: string;
  characterClasses: string[];
  found: boolean;
  /** A flag that overlaps it also named its type. */
  typeMatched: boolean;
  matchedBy: string[];
}

export interface Count {
  count: number;
  of: number;
}

export interface Score {
  documents: { total: number; scored: number; leftOut: Array<{ id: string; error: string }> };
  recall: Count;
  recallWithType: Count;
  recallByType: Array<{ type: GoldClauseType; found: Count; withType: Count }>;
  recallByCharacters: {
    plain: Count;
    special: Count;
    byClass: Array<{ id: string; label: string; found: Count }>;
  };
  outOfScope: Array<{ type: GoldClauseType; reason: string; foundAnyway: Count }>;
  groundedness: Count;
  groundednessInFile: Count;
  shownGroundedness: Count;
  clean: {
    documents: Count;
    flags: number;
    cleanReads: Count;
    perDocument: Array<{ id: string; flags: number; gaps: number; cleanRead: boolean; outcome: string }>;
  };
  unusualButHarmlessFlagged: Count;
  planted: ScoredPlanted[];
  shownFlags: ScoredFlag[];
  modelFlags: ScoredFlag[];
}

function count(items: readonly unknown[], of: number): Count {
  return { count: items.length, of };
}

/** `12/20 (60.0%)`, or `0/0 (n/a)` when there was nothing to count. */
export function formatCount({ count: n, of }: Count): string {
  if (of === 0) return `${n}/${of} (n/a)`;
  return `${n}/${of} (${((n / of) * 100).toFixed(1)}%)`;
}

/**
 * Locates a gold sentence in the text the pipeline reads. The pipeline collapses
 * runs of spaces and turns a non-breaking space into a plain one before any
 * model sees the text, so the sentence is normalised the same way first.
 */
function plantedSpans(normalizedText: string, sentence: string): Span[] {
  const spans = spansOf(normalizedText, normalizeDocumentText(sentence));
  if (spans.length === 0) {
    throw new Error(`A gold-set sentence is not in its document: ${sentence}`);
  }
  return spans;
}

function scoreFlag(
  flag: RecordedFlag,
  document: GoldDocument,
  normalizedText: string,
  planted: ReadonlyArray<{ clause: PlantedClause; spans: Span[] }>,
  harmless: ReadonlyArray<Span[]>,
): ScoredFlag {
  const spans = spansOf(normalizedText, flag.sourceSentence);
  return {
    documentId: document.id,
    id: flag.id,
    clauseType: flag.clauseType,
    mappedType: mapClauseType(flag.clauseType),
    severity: flag.severity,
    ...(flag.band ? { band: flag.band } : {}),
    sourceSentence: flag.sourceSentence,
    grounded: spans.length > 0,
    groundedInFile: document.text.includes(flag.sourceSentence),
    matchedPlanted: planted
      .filter((entry) => overlapsAny(spans, entry.spans))
      .map((entry) => entry.clause.id),
    onUnusualButHarmless: harmless.some((entry) => overlapsAny(spans, entry)),
  };
}

/** Scores a whole run. Failed documents are left out of every denominator. */
export function scoreRun(runs: readonly DocumentRun[]): Score {
  const scored = runs.filter((run) => run.outcome !== 'failed');
  const planted: ScoredPlanted[] = [];
  const shownFlags: ScoredFlag[] = [];
  const modelFlags: ScoredFlag[] = [];
  let harmlessFlagged = 0;

  for (const run of scored) {
    const { document } = run;
    const normalizedText = normalizeDocumentText(document.text);
    const plantedHere = document.plantedClauses.map((clause) => ({
      clause,
      spans: plantedSpans(normalizedText, clause.sourceSentence),
    }));
    const harmless = document.unusualButHarmless.map((sentence) =>
      plantedSpans(normalizedText, sentence),
    );

    const shown = run.shownFlags.map((flag) =>
      scoreFlag(flag, document, normalizedText, plantedHere, harmless),
    );
    shownFlags.push(...shown);
    const shownSpans = shown.map((flag) => spansOf(normalizedText, flag.sourceSentence));
    harmlessFlagged += harmless.filter((spans) =>
      shownSpans.some((flagSpans) => overlapsAny(flagSpans, spans)),
    ).length;
    modelFlags.push(
      ...run.modelFlags.map((flag) =>
        scoreFlag(flag, document, normalizedText, plantedHere, harmless),
      ),
    );

    for (const { clause } of plantedHere) {
      const matching = shown.filter((flag) => flag.matchedPlanted.includes(clause.id));
      planted.push({
        documentId: document.id,
        id: clause.id,
        clauseType: clause.clauseType,
        inScope: IN_SCOPE_TYPES.includes(clause.clauseType),
        sourceSentence: clause.sourceSentence,
        characterClasses: characterClassesIn(clause.sourceSentence),
        found: matching.length > 0,
        typeMatched: matching.some((flag) => flag.mappedType === clause.clauseType),
        matchedBy: matching.map((flag) => flag.id),
      });
    }
  }

  const inScope = planted.filter((clause) => clause.inScope);
  const found = inScope.filter((clause) => clause.found);
  const special = inScope.filter((clause) => clause.characterClasses.length > 0);
  const plain = inScope.filter((clause) => clause.characterClasses.length === 0);

  const benign = scored.filter((run) => run.document.benign);
  const harmlessTotal = scored.reduce(
    (total, run) => total + run.document.unusualButHarmless.length,
    0,
  );

  return {
    documents: {
      total: runs.length,
      scored: scored.length,
      leftOut: runs
        .filter((run) => run.outcome === 'failed')
        .map((run) => ({ id: run.document.id, error: run.error ?? 'unknown error' })),
    },
    recall: count(found, inScope.length),
    recallWithType: count(
      found.filter((clause) => clause.typeMatched),
      inScope.length,
    ),
    recallByType: IN_SCOPE_TYPES.map((type) => {
      const ofType = inScope.filter((clause) => clause.clauseType === type);
      const foundOfType = ofType.filter((clause) => clause.found);
      return {
        type,
        found: count(foundOfType, ofType.length),
        withType: count(
          foundOfType.filter((clause) => clause.typeMatched),
          ofType.length,
        ),
      };
    }),
    recallByCharacters: {
      plain: count(plain.filter((clause) => clause.found), plain.length),
      special: count(special.filter((clause) => clause.found), special.length),
      byClass: CHARACTER_CLASSES.map((cls) => {
        const carrying = inScope.filter((clause) =>
          clause.characterClasses.includes(cls.id),
        );
        return {
          id: cls.id,
          label: cls.label,
          found: count(carrying.filter((clause) => clause.found), carrying.length),
        };
      }),
    },
    outOfScope: Object.entries(OUT_OF_SCOPE).map(([type, reason]) => {
      const ofType = planted.filter((clause) => clause.clauseType === type);
      return {
        type: type as GoldClauseType,
        reason: reason as string,
        foundAnyway: count(ofType.filter((clause) => clause.found), ofType.length),
      };
    }),
    groundedness: count(
      modelFlags.filter((flag) => flag.grounded),
      modelFlags.length,
    ),
    groundednessInFile: count(
      modelFlags.filter((flag) => flag.groundedInFile),
      modelFlags.length,
    ),
    shownGroundedness: count(
      shownFlags.filter((flag) => flag.grounded),
      shownFlags.length,
    ),
    clean: {
      documents: count(
        benign.filter((run) => run.shownFlags.length === 0),
        benign.length,
      ),
      flags: benign.reduce((total, run) => total + run.shownFlags.length, 0),
      cleanReads: count(
        benign.filter((run) => run.cleanRead),
        benign.length,
      ),
      perDocument: benign.map((run) => ({
        id: run.document.id,
        flags: run.shownFlags.length,
        gaps: run.gapCount,
        cleanRead: run.cleanRead,
        outcome: run.outcome,
      })),
    },
    unusualButHarmlessFlagged: { count: harmlessFlagged, of: harmlessTotal },
    planted,
    shownFlags,
    modelFlags,
  };
}
