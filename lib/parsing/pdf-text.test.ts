import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { normalizeDocumentText } from '../document-text';
import { assemblePdfText, type PdfTextItem } from './pdf-text';

/**
 * Turns a fixture paragraph into the runs pdf.js would hand back for it: broken
 * at a fixed width, and split mid-line the way positioned text arrives.
 */
function asPdfPage(paragraphs: string[], width = 48): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      if (line.length + word.length + 1 > width) {
        lines.push(line);
        line = word;
      } else {
        line = line.length === 0 ? word : `${line} ${word}`;
      }
    }
    if (line.length > 0) lines.push(line);

    for (const rendered of lines) {
      const split = Math.floor(rendered.length / 2);
      items.push({ str: rendered.slice(0, split) });
      items.push({ str: rendered.slice(split), hasEOL: true });
    }
    items.push({ str: '', hasEOL: true });
  }
  return items;
}

describe('assemblePdfText', () => {
  it('puts a wrapped source sentence back together word for word', () => {
    const { sidecar } = loadAdhesionFixture();
    const sentences = sidecar.flags.map((flag) => flag.sourceSentence);

    const text = normalizeDocumentText(assemblePdfText([asPdfPage(sentences)]));

    for (const sentence of sentences) {
      expect(text).toContain(sentence);
    }
  });

  it('keeps a heading and a numbered clause on their own lines', () => {
    const items: PdfTextItem[] = [
      { str: '6. OWNERSHIP OF WORK PRODUCT', hasEOL: true },
      { str: 'Contractor assigns to Client all right, title, and', hasEOL: true },
      { str: 'interest in every work of authorship.', hasEOL: true },
      { str: '7. TERM', hasEOL: true },
    ];

    expect(assemblePdfText([items])).toBe(
      [
        '6. OWNERSHIP OF WORK PRODUCT',
        'Contractor assigns to Client all right, title, and interest in every work of authorship.',
        '7. TERM',
      ].join('\n'),
    );
  });

  it('rejoins a word broken by a hyphen at the line end', () => {
    const items: PdfTextItem[] = [
      { str: 'Contractor will not solicit any of the Client’s custo-', hasEOL: true },
      { str: 'mers during the term.', hasEOL: true },
    ];

    expect(assemblePdfText([items])).toBe(
      'Contractor will not solicit any of the Client’s customers during the term.',
    );
  });

  it('separates pages and drops the ones with nothing on them', () => {
    const text = assemblePdfText([
      [{ str: 'Page one text.', hasEOL: true }],
      [{ str: '   ', hasEOL: true }],
      [{ str: 'Page two text.', hasEOL: true }],
    ]);

    expect(text).toBe('Page one text.\n\nPage two text.');
  });

  it('returns nothing for a scanned page, rather than guessing at it', () => {
    expect(assemblePdfText([[], []])).toBe('');
  });
});
