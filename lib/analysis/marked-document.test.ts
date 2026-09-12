import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from './analyze-document';
import { markUpDocument, textLines } from './marked-document';
import type { Flag } from './verified-flag';

const { text, sidecar } = loadAdhesionFixture();

async function analysed() {
  return analyzeDocument(text, [], { model: stubModelClientFor(sidecar) });
}

describe('marking the flags on the page', () => {
  it('puts every flag on the sentence it quotes, in reading order', async () => {
    const { flags } = await analysed();

    const { pieces, marked } = markUpDocument(text, flags);

    expect(marked).toHaveLength(flags.length);
    const places = pieces
      .filter((piece) => piece.kind === 'flag')
      .map((piece) => piece.text);
    for (const flag of flags) {
      expect(places).toContain(flag.sourceSentence);
    }
    expect(places).toEqual(
      [...flags]
        .sort((a, b) => text.indexOf(a.sourceSentence) - text.indexOf(b.sourceSentence))
        .map((flag) => flag.sourceSentence),
    );
  });

  it('gives back the document unchanged when the pieces are put together', async () => {
    const { flags } = await analysed();

    const { pieces } = markUpDocument(text, flags);

    expect(pieces.map((piece) => piece.text).join('')).toBe(text);
  });

  it('numbers the marks worst first, whatever order they appear on the page in', async () => {
    const { flags } = await analysed();

    const { marked } = markUpDocument(text, flags);

    expect(marked.map((each) => each.rank)).toEqual(
      flags.map((_, index) => index + 1),
    );
    expect(marked.map((each) => each.flag.id)).toEqual(flags.map((flag) => flag.id));
  });

  it('leaves a flag off the page when its sentence is not in this text', async () => {
    const { flags } = await analysed();
    const elsewhere: Flag = {
      ...flags[0],
      id: 'from-another-document',
      sourceSentence:
        'Contractor shall deliver the Services from Client’s premises during Client’s business hours.',
    };

    const { pieces, marked } = markUpDocument(text, [...flags, elsewhere]);

    expect(marked.map((each) => each.flag.id)).not.toContain('from-another-document');
    expect(pieces.map((piece) => piece.text).join('')).toBe(text);
  });

  it('draws one sentence once when two flags land on it', async () => {
    const { flags } = await analysed();
    const twice: Flag = { ...flags[1], id: 'second-reading' };

    const { marked } = markUpDocument(text, [...flags, twice]);

    expect(marked).toHaveLength(flags.length);
  });

  it('reads a stretch of document as its non-empty lines', () => {
    expect(textLines('  One line \n\n  Another  \n')).toEqual([
      'One line',
      'Another',
    ]);
  });
});
