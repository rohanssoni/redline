import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { bandFor } from './ranking';
import { verifyFlags, type Flag } from './verified-flag';

const { text, sidecar } = loadAdhesionFixture();

function flagFor(sourceSentence: string, id = 'a-flag'): Flag {
  const planted = sidecar.flags[0];
  return {
    id,
    clauseType: planted.clauseType,
    sourceSentence,
    severity: planted.severity,
    band: bandFor(planted.severity),
    explanation: planted.explanation,
    textualAmbiguity: false,
    harmConfidence: 'full',
  };
}

describe('verifying a flag against the document it came from', () => {
  it('keeps a flag whose sentence is in the document', () => {
    const planted = sidecar.flags[0];

    const { flags, dropped } = verifyFlags([flagFor(planted.sourceSentence)], text);

    expect(dropped).toEqual([]);
    expect(flags).toHaveLength(1);
    expect(flags[0].sourceSentence).toBe(planted.sourceSentence);
    expect(flags[0].explanation).toBe(planted.explanation);
  });

  it('drops a flag whose sentence was invented, and says which one', () => {
    const fabricated =
      'Contractor agrees that Client may assign this Agreement to any person at any time without notice.';

    const { flags, dropped } = verifyFlags([flagFor(fabricated, 'invented')], text);

    expect(flags).toEqual([]);
    expect(dropped).toEqual([
      {
        id: 'invented',
        quoted: fabricated,
        reason: 'the quoted sentence is not in the document text',
      },
    ]);
  });

  it('drops a flag whose sentence was tidied up rather than copied', () => {
    const tidied = sidecar.flags[1].sourceSentence
      .replace('Client, in its sole discretion,', 'Client in its sole discretion')
      .toUpperCase();

    const { flags } = verifyFlags([flagFor(tidied, 'tidied')], text);

    expect(flags).toEqual([]);
  });

  it('shows the document’s wording, not the quote it was given', () => {
    const planted = sidecar.flags[2];
    const wrapped = planted.sourceSentence.split(' ').join('\n  ');

    const { flags } = verifyFlags([flagFor(wrapped, 'wrapped')], text);

    expect(flags[0].sourceSentence).toBe(planted.sourceSentence);
    expect(flags[0].sourceSentence).not.toBe(wrapped);
  });

  it('keeps the real flags in a batch and drops only the unfounded ones', () => {
    const batch = [
      flagFor(sidecar.flags[0].sourceSentence, 'real-one'),
      flagFor('Contractor shall work exclusively for Client at all times.', 'made-up'),
      flagFor(sidecar.flags[3].sourceSentence, 'real-two'),
    ];

    const { flags, dropped } = verifyFlags(batch, text);

    expect(flags.map((flag) => flag.id)).toEqual(['real-one', 'real-two']);
    expect(dropped.map((drop) => drop.id)).toEqual(['made-up']);
  });

  it('never returns a flag without a sentence found in the document', () => {
    const everything = [
      ...sidecar.flags.map((flag) => flagFor(flag.sourceSentence, flag.id)),
      flagFor('', 'empty'),
      flagFor('   ', 'blank'),
      flagFor('A sentence this agreement does not contain.', 'absent'),
    ];

    const { flags } = verifyFlags(everything, text);

    for (const flag of flags) {
      expect(text).toContain(flag.sourceSentence);
    }
    expect(flags.map((flag) => flag.id)).not.toContain('empty');
    expect(flags.map((flag) => flag.id)).not.toContain('blank');
    expect(flags.map((flag) => flag.id)).not.toContain('absent');
  });
});
