import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture, loadCleanFixture } from '../../tests/fixtures';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import { SEVERITY_THRESHOLD } from '../analysis/ranking';
import { toAnalysisResult } from './store';

/**
 * The analysis column is jsonb, so a row holds whatever was written into it. A
 * clean read is the one claim in the product that says a document is fine, which
 * makes the column the place a false one would come from. It is worked out again
 * on the way out, never read off the row (ADR-0008).
 */
describe('a stored analysis, on the way back out', () => {
  it('keeps the clean read of a document that earned one', async () => {
    const { text, sidecar } = loadCleanFixture();
    const analysis = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    const readBack = toAnalysisResult(JSON.parse(JSON.stringify(analysis)), text);

    expect(readBack?.cleanRead).not.toBeNull();
    expect(readBack?.cleanRead?.threshold).toBe(SEVERITY_THRESHOLD);
    expect(readBack?.summary).toBe(sidecar.summary);
  });

  it('refuses a row that claims a clean read while carrying flags', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const analysis = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });
    expect(analysis.flags.length).toBeGreaterThan(0);

    const tampered = {
      ...JSON.parse(JSON.stringify(analysis)),
      cleanRead: { threshold: SEVERITY_THRESHOLD },
    };

    const readBack = toAnalysisResult(tampered, text);

    expect(readBack?.cleanRead).toBeNull();
    expect(readBack?.flags.length).toBe(analysis.flags.length);
  });

  it('refuses a row that claims a clean read while carrying a gap', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const gap = sidecar.gaps[0];

    const readBack = toAnalysisResult(
      {
        summary: sidecar.summary,
        flags: [],
        gaps: [
          {
            id: gap.id,
            statement: gap.statement,
            severity: gap.severity,
            band: gap.band,
            explanation: gap.explanation,
          },
        ],
        cleanRead: { threshold: SEVERITY_THRESHOLD },
      },
      text,
    );

    expect(readBack?.gaps).toHaveLength(1);
    expect(readBack?.cleanRead).toBeNull();
  });

  it('gives a row a clean read once its flags no longer quote the document', async () => {
    const { sidecar } = loadAdhesionFixture();
    const clean = loadCleanFixture();
    const flag = sidecar.flags[0];

    // The row was written against one document and is being read against
    // another, so every flag fails the quote check on the way out. What is left
    // is a document with nothing on it, and that is a clean read rather than a
    // half-result, because the summary is still there.
    const readBack = toAnalysisResult(
      {
        summary: clean.sidecar.summary,
        flags: [
          {
            id: flag.id,
            clauseType: flag.clauseType,
            sourceSentence: flag.sourceSentence,
            severity: flag.severity,
            band: flag.band,
            explanation: flag.explanation,
            textualAmbiguity: flag.textualAmbiguity,
            harmConfidence: flag.harmConfidence,
          },
        ],
        gaps: [],
      },
      clean.text,
    );

    expect(readBack?.flags).toEqual([]);
    expect(readBack?.cleanRead).not.toBeNull();
  });

  it('reads a column that is not an analysis as nothing at all, never as clean', () => {
    const { text } = loadCleanFixture();

    for (const value of [null, 'clean', 42, [], {}, { summary: '   ', flags: [], gaps: [] }]) {
      expect(toAnalysisResult(value, text)).toBeNull();
    }
  });
});
