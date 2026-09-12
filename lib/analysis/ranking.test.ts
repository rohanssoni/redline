import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { proposedFlagsFor } from '../../tests/support/stub-model-client';
import { bandFor, dangerousOnly, isDangerousToTheReader, rankFlags } from './ranking';
import { verifyFlags, type ProposedFlag } from './verified-flag';

const { text, sidecar } = loadAdhesionFixture();

function proposals(): ProposedFlag[] {
  return (proposedFlagsFor(sidecar) as ProposedFlag[]).map((flag) => ({
    ...flag,
    band: bandFor(flag.severity),
  }));
}

describe('the bands a reader sees', () => {
  it('gives every planted flag the band the fixture says it has', () => {
    for (const flag of sidecar.flags) {
      expect(bandFor(flag.severity)).toBe(flag.band);
    }
    for (const gap of sidecar.gaps) {
      expect(bandFor(gap.severity)).toBe(gap.band);
    }
  });

  it('bands by what the clause costs, across the range', () => {
    expect(bandFor(100)).toBe('high');
    expect(bandFor(65)).toBe('high');
    expect(bandFor(64)).toBe('medium');
    expect(bandFor(35)).toBe('medium');
    expect(bandFor(34)).toBe('low');
    expect(bandFor(0)).toBe('low');
  });
});

describe('the plausibility filter, before any ranking', () => {
  it('drops the unusual but even-handed clause entirely', () => {
    const symmetric = sidecar.decoys.symmetricUnusual;
    expect(symmetric).toBeDefined();

    const kept = dangerousOnly(proposals());

    expect(
      kept.some((flag) => flag.sourceSentence === symmetric?.sourceSentence),
    ).toBe(false);
    expect(kept.some((flag) => flag.severity < 35)).toBe(false);
  });

  it('drops a clause that moves nobody’s money, however odd its wording', () => {
    const [planted] = proposals();

    expect(
      isDangerousToTheReader({
        ...planted,
        changesYourEconomicsUnilaterally: false,
        bindsBothSidesEqually: false,
      }),
    ).toBe(false);
  });

  it('keeps a clause that lets the other side change the reader’s economics alone', () => {
    const kept = dangerousOnly(proposals()).map((flag) => flag.id);
    const expected = sidecar.flags
      .filter((flag) => flag.plausible !== false)
      .map((flag) => flag.id);

    expect(kept).toEqual(expected);
  });

  it('keeps a clause the reading is only partly confident about', () => {
    const partial = sidecar.flags.filter(
      (flag) => flag.harmConfidence === 'partial' && flag.plausible !== false,
    );
    expect(partial.length).toBeGreaterThan(0);

    const kept = dangerousOnly(proposals()).map((flag) => flag.id);

    for (const flag of partial) {
      expect(kept).toContain(flag.id);
    }
  });
});

describe('the order the reader reads in', () => {
  it('lists flags worst first', () => {
    const { flags } = verifyFlags(dangerousOnly(proposals()), text);

    const ranked = rankFlags(flags);

    expect(ranked.map((flag) => flag.severity)).toEqual(
      [...ranked.map((flag) => flag.severity)].sort((a, b) => b - a),
    );
    expect(ranked[0].severity).toBe(
      Math.max(...ranked.map((flag) => flag.severity)),
    );
  });

  it('keeps the graver reading when two flags quote the same sentence', () => {
    const { flags } = verifyFlags(dangerousOnly(proposals()), text);
    const twice = [
      flags[0],
      { ...flags[0], id: 'milder-reading', severity: 10 },
      flags[1],
    ];

    const ranked = rankFlags(twice);

    expect(ranked).toHaveLength(2);
    expect(ranked.map((flag) => flag.id)).not.toContain('milder-reading');
  });
});
