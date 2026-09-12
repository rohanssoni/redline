import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { verifyGaps, quotesTheDocument, type GapClaim } from './gap';
import { rankFindings, rankGaps } from './ranking';

const { text, sidecar } = loadAdhesionFixture();

/** A gap as the model proposes it, banded, before the check has run. */
function claim(overrides: Partial<GapClaim> = {}): GapClaim {
  const [first] = sidecar.gaps;
  return {
    id: first.id,
    severity: first.severity,
    band: first.band,
    statement: first.statement,
    explanation: first.explanation,
    ...overrides,
  };
}

describe('checking a gap against the whole document', () => {
  it('keeps a claim about what the agreement does not contain', () => {
    const { gaps, dropped } = verifyGaps([claim()], text);

    expect(dropped).toEqual([]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].statement).toBe(sidecar.gaps[0].statement);
    expect(gaps[0].explanation).toBe(sidecar.gaps[0].explanation);
  });

  it('keeps every gap the fixture plants', () => {
    const { gaps } = verifyGaps(
      sidecar.gaps.map((gap) => claim({ ...gap })),
      text,
    );

    expect(gaps.map((gap) => gap.id)).toEqual(sidecar.gaps.map((gap) => gap.id));
  });

  it('drops a statement that repeats the agreement’s own wording', () => {
    const quoting = claim({
      id: 'lifted-from-the-page',
      statement: sidecar.flags[0].sourceSentence,
    });

    const { gaps, dropped } = verifyGaps([quoting], text);

    expect(gaps).toEqual([]);
    expect(dropped.map((each) => each.id)).toEqual(['lifted-from-the-page']);
    expect(dropped[0].reason).toMatch(/quotes the document/);
  });

  it('drops a statement that lifts a phrase out of the middle of a sentence', () => {
    const words = sidecar.flags[2].sourceSentence.split(/\s+/).slice(3, 12).join(' ');
    const quoting = claim({ id: 'lifted-phrase', statement: `This agreement says ${words}` });

    const { gaps, dropped } = verifyGaps([quoting], text);

    expect(gaps).toEqual([]);
    expect(dropped[0].reason).toMatch(/quotes the document/);
  });

  it('drops a gap that arrived carrying a source sentence', () => {
    // Only a stored row or a hand-edited payload can be this shape. Note the
    // double cast: `as GapClaim` on its own does not compile, because the two
    // types do not overlap, which is ADR-0005 being enforced by the compiler.
    const smuggled = {
      ...claim({ id: 'gap-with-a-citation' }),
      sourceSentence: sidecar.flags[0].sourceSentence,
    } as unknown as GapClaim;

    const { gaps, dropped } = verifyGaps([smuggled], text);

    expect(gaps).toEqual([]);
    expect(dropped[0].reason).toMatch(/source sentence/);
  });

  it('drops a gap that states nothing', () => {
    const { gaps, dropped } = verifyGaps([claim({ statement: '   ' })], text);

    expect(gaps).toEqual([]);
    expect(dropped).toHaveLength(1);
  });

  it('hands back no gap carrying a source sentence, whatever went in', () => {
    const { gaps } = verifyGaps(
      [
        claim(),
        { ...claim({ id: 'second' }), sourceSentence: 'anything' } as unknown as GapClaim,
      ],
      text,
    );

    for (const gap of gaps) {
      expect(Object.keys(gap)).not.toContain('sourceSentence');
    }
  });
});

describe('reading a statement as a quotation', () => {
  it('sees a run of the document’s own words, wrapped or not', () => {
    const sentence = sidecar.flags[1].sourceSentence;

    expect(quotesTheDocument(sentence, text)).toBe(true);
    expect(quotesTheDocument(sentence.split(' ').join('\n'), text)).toBe(true);
  });

  it('leaves a plain claim about the whole agreement alone', () => {
    for (const gap of sidecar.gaps) {
      expect(quotesTheDocument(gap.statement, text)).toBe(false);
    }
  });

  it('does not call a few shared words a quotation', () => {
    expect(quotesTheDocument('This agreement says nothing about payment.', text)).toBe(
      false,
    );
  });
});

describe('ranking gaps with flags', () => {
  it('puts a severe gap above a milder flag without making it a flag', () => {
    const { gaps } = verifyGaps([claim({ severity: 99 })], text);
    const flag = {
      id: 'mild-clause',
      clauseType: 'a mild clause',
      sourceSentence: sidecar.flags[0].sourceSentence,
      severity: 20,
      band: 'low' as const,
      explanation: sidecar.flags[0].explanation,
      textualAmbiguity: false,
      harmConfidence: 'full' as const,
    };

    const findings = rankFindings([flag], gaps);

    expect(findings[0].kind).toBe('gap');
    expect(findings[0].rank).toBe(1);
    expect(findings[1].kind).toBe('flag');
    if (findings[0].kind === 'gap') {
      expect(findings[0].gap).not.toHaveProperty('sourceSentence');
    }
  });

  it('claims one absence once, keeping the graver reading of it', () => {
    const { gaps } = verifyGaps(
      [claim({ id: 'milder', severity: 30 }), claim({ id: 'graver', severity: 80 })],
      text,
    );

    expect(rankGaps(gaps).map((gap) => gap.id)).toEqual(['graver']);
  });

  it('breaks a tie the same way every time', () => {
    const { gaps } = verifyGaps(
      [
        claim({ id: 'zebra', statement: 'This agreement sets no limit on revisions.' }),
        claim({ id: 'alpha', statement: 'This agreement names no delivery date.' }),
      ],
      text,
    );

    expect(rankGaps(gaps).map((gap) => gap.id)).toEqual(['alpha', 'zebra']);
    expect(rankFindings([], gaps).map((finding) => finding.id)).toEqual([
      'alpha',
      'zebra',
    ]);
  });
});
