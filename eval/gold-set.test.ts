import { describe, expect, it } from 'vitest';
import { normalizeDocumentText } from '../lib/document-text';
import {
  GOLD_CLAUSE_TYPES,
  claimedSentences,
  goldSetAvailable,
  loadGoldSet,
} from './gold-set';
import { spansOf } from './scoring';

/**
 * The gold set's one rule: every sentence it names is in its document, character
 * for character, exactly once. A sentence that drifted would score a miss the
 * model never made, so this runs with the normal suite, with no model and no
 * network. The gold set lives outside the repo, so on a machine without it
 * these tests are skipped, not failed.
 */
const available = goldSetAvailable();

describe.each(
  (available ? loadGoldSet() : []).map((document) => [document.id, document] as const),
)(
  'gold-set document %s',
  (_id, document) => {
    it.each(claimedSentences(document).map((claim) => [claim.where, claim.sentence]))(
      '%s appears exactly once in the file',
      (_where, sentence) => {
        expect(sentence.length).toBeGreaterThan(0);
        expect(spansOf(document.text, sentence)).toHaveLength(1);
      },
    );

    // The eval locates sentences in the text the pipeline reads, after
    // normalisation, so they have to stay unique there too.
    it('keeps every planted sentence unique once the text is normalised', () => {
      const normalized = normalizeDocumentText(document.text);
      for (const clause of document.plantedClauses) {
        expect(
          spansOf(normalized, normalizeDocumentText(clause.sourceSentence)),
        ).toHaveLength(1);
      }
    });

    it('plants only the seven gold-set clause types', () => {
      for (const clause of document.plantedClauses) {
        expect(GOLD_CLAUSE_TYPES).toContain(clause.clauseType);
      }
    });

    it(document.benign ? 'plants nothing, being benign' : 'plants at least one clause', () => {
      expect(document.plantedClauses.length === 0).toBe(document.benign);
    });
  },
);

describe.skipIf(!available)('the gold set as a whole', () => {
  it('holds nine documents and forty planted clauses', () => {
    const documents = loadGoldSet();
    expect(documents).toHaveLength(9);
    expect(
      documents.reduce((total, document) => total + document.plantedClauses.length, 0),
    ).toBe(40);
  });
});
