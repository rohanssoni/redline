import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import {
  DISMISSAL_SIGNAL_NOTE,
  dismissalRatesOf,
  shownFlagIn,
  shownFlagsOf,
  type ShownFlag,
} from './store';

const DOCUMENT = '5f4d3c2b-1a09-4e8f-9d7c-6b5a4f3e2d10';
const OTHER_DOCUMENT = '0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

async function readWithRedLines() {
  const { text, sidecar } = loadAdhesionFixture();
  return analyzeDocument(text, sidecar.redLines, {
    model: stubModelClientFor(sidecar),
  });
}

async function readWithNoRedLines() {
  const { text, sidecar } = loadAdhesionFixture();
  return analyzeDocument(text, [], { model: stubModelClientFor(sidecar) });
}

describe('the flags a read put in front of the reader', () => {
  it('marks the ones a red line put there, and leaves the rest ordinary', async () => {
    const analysis = await readWithRedLines();
    expect(analysis.redLineMatches.length).toBeGreaterThan(0);

    const shown = shownFlagsOf(DOCUMENT, analysis);

    expect(shown.length).toBe(analysis.flags.length);
    const triggered = shown
      .filter((flag) => flag.redLineTriggered)
      .map((flag) => flag.flagId)
      .sort();
    expect(triggered).toEqual(
      analysis.redLineMatches.map((match) => match.flagId).sort(),
    );
    expect(shown.some((flag) => !flag.redLineTriggered)).toBe(true);
  });

  it('marks nothing when the reader stated no red lines', async () => {
    const analysis = await readWithNoRedLines();

    const shown = shownFlagsOf(DOCUMENT, analysis);

    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((flag) => !flag.redLineTriggered)).toBe(true);
  });

  it('counts no gap among them, though the read found gaps', async () => {
    const analysis = await readWithRedLines();
    expect(analysis.gaps.length).toBeGreaterThan(0);

    const shown = shownFlagsOf(DOCUMENT, analysis);

    const shownIds = new Set(shown.map((flag) => flag.flagId));
    for (const gap of analysis.gaps) {
      expect(shownIds.has(gap.id)).toBe(false);
    }
  });
});

describe('looking one flag up before it can be set aside', () => {
  it('finds a flag of this read and says which kind it is', async () => {
    const analysis = await readWithRedLines();
    const match = analysis.redLineMatches[0];

    const found = shownFlagIn(DOCUMENT, analysis, match.flagId);

    expect(found).toEqual({
      documentId: DOCUMENT,
      flagId: match.flagId,
      redLineTriggered: true,
    });
  });

  it('refuses a gap, so a gap can never reach the metric', async () => {
    const analysis = await readWithRedLines();
    expect(analysis.gaps.length).toBeGreaterThan(0);

    for (const gap of analysis.gaps) {
      expect(shownFlagIn(DOCUMENT, analysis, gap.id)).toBeNull();
    }
  });

  it('refuses an id this read has never carried', async () => {
    const analysis = await readWithRedLines();

    expect(shownFlagIn(DOCUMENT, analysis, 'no-such-flag')).toBeNull();
  });
});

describe('the two dismissal rates', () => {
  const shown: ShownFlag[] = [
    { documentId: DOCUMENT, flagId: 'a', redLineTriggered: false },
    { documentId: DOCUMENT, flagId: 'b', redLineTriggered: false },
    { documentId: DOCUMENT, flagId: 'c', redLineTriggered: false },
    { documentId: DOCUMENT, flagId: 'd', redLineTriggered: false },
    { documentId: DOCUMENT, flagId: 'e', redLineTriggered: true },
    { documentId: DOCUMENT, flagId: 'f', redLineTriggered: true },
  ];

  it('counts a mixed set of dismissals apart, not one rate twice', () => {
    const rates = dismissalRatesOf(shown, [
      { documentId: DOCUMENT, flagId: 'a' },
      { documentId: DOCUMENT, flagId: 'e' },
      { documentId: DOCUMENT, flagId: 'f' },
    ]);

    expect(rates.ordinary).toEqual({
      shown: 4,
      dismissed: 1,
      dismissalRate: 0.25,
    });
    expect(rates.redLineTriggered).toEqual({
      shown: 2,
      dismissed: 2,
      dismissalRate: 1,
    });
    expect(rates.ordinary.dismissalRate).not.toBe(
      rates.redLineTriggered.dismissalRate,
    );
  });

  it('reports no rate where nothing of that kind was shown', () => {
    const rates = dismissalRatesOf(
      shown.filter((flag) => !flag.redLineTriggered),
      [{ documentId: DOCUMENT, flagId: 'a' }],
    );

    expect(rates.redLineTriggered.shown).toBe(0);
    expect(rates.redLineTriggered.dismissalRate).toBeNull();
    expect(rates.ordinary.dismissalRate).toBe(0.25);
  });

  it('leaves both rates at nothing when no flag has been shown at all', () => {
    const rates = dismissalRatesOf([], []);

    expect(rates.ordinary.dismissalRate).toBeNull();
    expect(rates.redLineTriggered.dismissalRate).toBeNull();
  });

  it('ignores a dismissal of a flag nobody is being shown any more', () => {
    const rates = dismissalRatesOf(shown, [
      { documentId: DOCUMENT, flagId: 'gone-in-the-re-read' },
      { documentId: DOCUMENT, flagId: 'b' },
    ]);

    expect(rates.ordinary.dismissed).toBe(1);
    expect(rates.ordinary.dismissalRate).toBe(0.25);
  });

  it('does not let one document’s dismissal count against another’s flag', () => {
    const rates = dismissalRatesOf(shown, [
      { documentId: OTHER_DOCUMENT, flagId: 'a' },
    ]);

    expect(rates.ordinary.dismissed).toBe(0);
    expect(rates.ordinary.dismissalRate).toBe(0);
  });

  it('has no combined rate to report, and says what the split is worth', () => {
    const rates = dismissalRatesOf(shown, [{ documentId: DOCUMENT, flagId: 'a' }]);

    expect(rates.note).toBe(DISMISSAL_SIGNAL_NOTE);
    expect(Object.keys(rates).sort()).toEqual([
      'note',
      'ordinary',
      'redLineTriggered',
    ]);
  });

  it('counts real flags of a real read, gaps and all, with only the flags in the denominator', async () => {
    const analysis = await readWithRedLines();
    const shownFlags = shownFlagsOf(DOCUMENT, analysis);
    const ordinary = shownFlags.filter((flag) => !flag.redLineTriggered);
    const triggered = shownFlags.filter((flag) => flag.redLineTriggered);

    const rates = dismissalRatesOf(shownFlags, [
      { documentId: DOCUMENT, flagId: ordinary[0].flagId },
      // A gap id, as a stray row would carry it. It matches no shown flag.
      { documentId: DOCUMENT, flagId: analysis.gaps[0].id },
    ]);

    expect(rates.ordinary.shown).toBe(ordinary.length);
    expect(rates.ordinary.dismissed).toBe(1);
    expect(rates.redLineTriggered.shown).toBe(triggered.length);
    expect(rates.redLineTriggered.dismissed).toBe(0);
  });
});
