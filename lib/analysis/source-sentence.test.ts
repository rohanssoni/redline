import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { containsSourceSentence, findSourceSentence } from './source-sentence';

const { text, sidecar } = loadAdhesionFixture();
const real = sidecar.flags[0].sourceSentence;

describe('finding a quoted sentence in the document', () => {
  it('finds every sentence the fixture plants, in the fixture text', () => {
    for (const flag of sidecar.flags) {
      expect(findSourceSentence(text, flag.sourceSentence)).toBe(
        flag.sourceSentence,
      );
    }
  });

  it('does not find a sentence that is nowhere in the document', () => {
    const fabricated =
      'Contractor waives all rights to payment for any work Client later decides it no longer needs.';

    expect(findSourceSentence(text, fabricated)).toBeNull();
    expect(containsSourceSentence(text, fabricated)).toBe(false);
  });

  it('does not find a real sentence that has been tidied up', () => {
    expect(findSourceSentence(text, real.replace(/,/g, ''))).toBeNull();
    expect(findSourceSentence(text, real.toLowerCase())).toBeNull();
    expect(findSourceSentence(text, real.replace(/\.$/, '!'))).toBeNull();
    expect(findSourceSentence(text, real.replace(/,/g, ';'))).toBeNull();
  });

  it('does not find a sentence that has lost or gained a word', () => {
    const words = real.split(' ');
    expect(findSourceSentence(text, words.slice(1).join(' '))).not.toBeNull();
    expect(
      findSourceSentence(text, [...words.slice(0, 3), ...words.slice(4)].join(' ')),
    ).toBeNull();
    expect(
      findSourceSentence(text, real.replace(' and ', ' and promptly ')),
    ).toBeNull();
  });

  it('reads across a line break a parser put in the middle of a sentence', () => {
    const broken = real.replace(' ', '\n   ');

    expect(findSourceSentence(text, broken)).toBe(real);
  });

  it('finds a sentence in a document a parser broke across lines', () => {
    const split = text.replace(real, real.split(' ').join('\n'));

    const found = findSourceSentence(split, real);
    expect(found).toBe(real.split(' ').join('\n'));
    expect(found?.replace(/\s+/g, ' ')).toBe(real);
  });

  it('gives back the document’s wording, not the quote it was handed', () => {
    const quoted = `   ${real.replace(/ /g, '  ')}\t`;

    expect(findSourceSentence(text, quoted)).toBe(real);
  });

  it('finds nothing for a quote with no words in it', () => {
    expect(findSourceSentence(text, '')).toBeNull();
    expect(findSourceSentence(text, '   \n  ')).toBeNull();
  });
});
