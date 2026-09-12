import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { settleWording, withoutUnverifiableHedging } from './hedging';

const { sidecar } = loadAdhesionFixture();

const ambiguous = sidecar.decoys.textuallyAmbiguous;
const plainButUncertain = sidecar.decoys.nonTextualLowConfidence;

/** The flag the sidecar plants for each decoy, so wording comes from the fixture. */
function flagFor(sourceSentence: string | undefined) {
  const flag = sidecar.flags.find((each) => each.sourceSentence === sourceSentence);
  expect(flag).toBeDefined();
  return flag!;
}

describe('settling what a flag is allowed to say', () => {
  it('hedges the sentence that reads two ways, and shows both readings in the hedge', () => {
    expect(ambiguous).toBeDefined();
    const flag = flagFor(ambiguous?.sourceSentence);

    const settled = settleWording({
      explanation: flag.explanation,
      textualAmbiguity: true,
      alternativeReadings: [ambiguous!.readingA, ambiguous!.readingB],
    });

    expect(settled?.textualAmbiguity).toBe(true);
    expect(settled?.ambiguity?.readings).toEqual([
      ambiguous!.readingA,
      ambiguous!.readingB,
    ]);
    expect(settled?.ambiguity?.hedge).toContain(ambiguous!.readingA);
    expect(settled?.ambiguity?.hedge).toContain(ambiguous!.readingB);
    expect(settled?.ambiguity?.hedge).toMatch(/could be read two ways/i);
    expect(settled?.explanation).toBe(flag.explanation);
  });

  it('states the clause plainly when the doubt is about enforcement rather than wording', () => {
    expect(plainButUncertain).toBeDefined();
    const flag = flagFor(plainButUncertain?.sourceSentence);
    expect(flag.harmConfidence).toBe('partial');

    const settled = settleWording({
      explanation: flag.explanation,
      textualAmbiguity: flag.textualAmbiguity,
      alternativeReadings: [],
    });

    expect(settled?.textualAmbiguity).toBe(false);
    expect(settled?.ambiguity).toBeNull();
    expect(settled?.explanation).toBe(flag.explanation);
    expect(settled?.explanation).not.toMatch(
      /\b(could|may|might|possibly|arguably|probably|likely)\b/i,
    );
  });

  it('refuses to hedge on a claim of ambiguity with no second reading behind it', () => {
    const flag = flagFor(plainButUncertain?.sourceSentence);

    const settled = settleWording({
      explanation: flag.explanation,
      textualAmbiguity: true,
      alternativeReadings: [],
    });

    expect(settled?.ambiguity).toBeNull();
    expect(settled?.textualAmbiguity).toBe(false);
  });

  it('refuses to hedge when the same reading was sent back twice', () => {
    expect(ambiguous).toBeDefined();
    const flag = flagFor(ambiguous?.sourceSentence);

    const settled = settleWording({
      explanation: flag.explanation,
      textualAmbiguity: true,
      alternativeReadings: [ambiguous!.readingA, ambiguous!.readingA],
    });

    expect(settled?.ambiguity).toBeNull();
    expect(settled?.textualAmbiguity).toBe(false);
  });

  it('refuses to hedge when a reading is about a court rather than the sentence', () => {
    expect(ambiguous).toBeDefined();
    const flag = flagFor(ambiguous?.sourceSentence);

    const settled = settleWording({
      explanation: flag.explanation,
      textualAmbiguity: true,
      alternativeReadings: [
        ambiguous!.readingA,
        'A court would probably not enforce the update right against you.',
      ],
    });

    expect(settled?.ambiguity).toBeNull();
  });

  it('takes an enforceability hedge out of the wording and keeps the rest', () => {
    const flag = flagFor(plainButUncertain?.sourceSentence);
    const courtroom =
      'A court might not enforce a restriction this wide against a contractor.';

    const settled = settleWording({
      explanation: `${flag.explanation} ${courtroom}`,
      textualAmbiguity: false,
      alternativeReadings: [],
    });

    expect(settled?.explanation).toBe(flag.explanation);
    expect(settled?.explanation).not.toContain('court');
    expect(settled?.struck).toEqual([courtroom]);
  });

  it('takes the same hedge out of a flag that is allowed to hedge about its wording', () => {
    expect(ambiguous).toBeDefined();
    const flag = flagFor(ambiguous?.sourceSentence);

    const settled = settleWording({
      explanation: `${flag.explanation} It is unclear whether this is enforceable.`,
      textualAmbiguity: true,
      alternativeReadings: [ambiguous!.readingA, ambiguous!.readingB],
    });

    expect(settled?.explanation).toBe(flag.explanation);
    expect(settled?.ambiguity?.hedge).toContain(ambiguous!.readingB);
  });

  it('drops a flag with nothing left once the unverifiable hedging is out', () => {
    const settled = settleWording({
      explanation:
        'A court would probably read this down. It is unclear whether anyone enforces terms like this in practice.',
      textualAmbiguity: false,
      alternativeReadings: [],
    });

    expect(settled).toBeNull();
  });

  it('leaves a statement about what the clause costs alone, hedge-shaped or not', () => {
    const consequence =
      'A single claim could cost you more than the whole fee. Nothing here caps what you can be made to pay.';

    const { kept, struck } = withoutUnverifiableHedging(consequence);

    expect(kept).toBe(consequence);
    expect(struck).toEqual([]);
  });
});
