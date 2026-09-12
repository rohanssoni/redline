import { describe, expect, it, vi } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import {
  counterOfferFor,
  createStubModelClient,
  stubModelClientFor,
} from '../../tests/support/stub-model-client';
import type { StructuredRequest } from '../model/client';
import { ModelCallError } from '../model/client';
import { analyzeDocument } from './analyze-document';
import {
  COUNTER_OFFER_CALL_NAME,
  draftCounterOffer,
  draftSoftCounterOffers,
  verifyCounterOffers,
  type ClauseToRewrite,
} from './counter-offer';
import type { AnalysisResult } from './types';

/** A real read of the adhesion fixture, so the flags below quote the document. */
async function readAdhesion(): Promise<{
  analysis: AnalysisResult;
  text: string;
  sidecar: ReturnType<typeof loadAdhesionFixture>['sidecar'];
}> {
  const { text, sidecar } = loadAdhesionFixture();
  const analysis = await analyzeDocument(text, sidecar.redLines, {
    model: stubModelClientFor(sidecar),
  });
  return { analysis, text, sidecar };
}

/** The drafting calls a stub was asked to answer, in the order they were made. */
function draftingCalls(calls: readonly StructuredRequest[]): StructuredRequest[] {
  return calls.filter((call) => call.name === COUNTER_OFFER_CALL_NAME);
}

describe('drafting a counter-offer for one flagged clause', () => {
  it('drafts replacement language anchored to that flag’s own source sentence', async () => {
    const { analysis } = await readAdhesion();
    const flag = analysis.flags[0];
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });

    const counterOffer = await draftCounterOffer(flag, 'soft', { model });

    expect(counterOffer).not.toBeNull();
    expect(counterOffer?.flagId).toBe(flag.id);
    expect(counterOffer?.stance).toBe('soft');
    expect(counterOffer?.sourceSentence).toBe(flag.sourceSentence);
    expect(counterOffer?.text.length).toBeGreaterThan(0);
  });

  it('asks about the one clause it is rewriting, and no other', async () => {
    const { analysis } = await readAdhesion();
    const flag = analysis.flags[0];
    const otherSentences = analysis.flags
      .slice(1)
      .map((other) => other.sourceSentence);
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });

    await draftCounterOffer(flag, 'soft', { model });

    const [request] = draftingCalls(model.calls);
    const sent = request.messages.map((message) => message.content).join('\n');
    expect(sent).toContain(flag.sourceSentence);
    for (const sentence of otherSentences) {
      expect(sent).not.toContain(sentence);
    }
    expect(sent).toContain('soft');
    expect(request.schema.additionalProperties).toBe(false);
    expect(request.schema.required).toEqual(['rewrites', 'replacement']);
  });

  it('refuses a draft that rewrote a different clause rather than showing it', async () => {
    const { analysis } = await readAdhesion();
    const flag = analysis.flags[0];
    const somebodyElses = analysis.flags[1].sourceSentence;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: {
        rewrites: somebodyElses,
        replacement:
          'The parties agree that this clause applies only with the other party’s written consent.',
      },
    });

    const counterOffer = await draftCounterOffer(flag, 'soft', { model });

    expect(counterOffer).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('refuses a draft that quotes only part of the sentence it was given', async () => {
    const { analysis } = await readAdhesion();
    const flag = analysis.flags[0];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: {
        rewrites: flag.sourceSentence.slice(0, 40),
        replacement:
          'The parties agree that this clause applies only with the other party’s written consent.',
      },
    });

    expect(await draftCounterOffer(flag, 'soft', { model })).toBeNull();
    warn.mockRestore();
  });

  it('keeps a draft whose copied sentence was rewrapped on the way back', async () => {
    const { analysis } = await readAdhesion();
    const flag = analysis.flags[0];
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: {
        rewrites: flag.sourceSentence.replace(/\s+/g, '\n  '),
        replacement:
          'The parties agree that this clause applies only with the other party’s written consent.',
      },
    });

    const counterOffer = await draftCounterOffer(flag, 'soft', { model });

    expect(counterOffer?.sourceSentence).toBe(flag.sourceSentence);
  });
});

describe('drafting counter-offers for a whole read', () => {
  it('drafts exactly one soft counter-offer per flag', async () => {
    const { analysis } = await readAdhesion();
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });

    const counterOffers = await draftSoftCounterOffers(analysis.flags, { model });

    expect(analysis.flags.length).toBeGreaterThan(1);
    expect(draftingCalls(model.calls)).toHaveLength(analysis.flags.length);
    expect(counterOffers).toHaveLength(analysis.flags.length);
    expect(counterOffers.map((each) => each.flagId)).toEqual(
      analysis.flags.map((flag) => flag.id),
    );
    expect(counterOffers.every((each) => each.stance === 'soft')).toBe(true);
    for (const counterOffer of counterOffers) {
      const flag = analysis.flags.find((each) => each.id === counterOffer.flagId);
      expect(counterOffer.sourceSentence).toBe(flag?.sourceSentence);
    }
  });

  it('drafts nothing for a gap, however severe it is', async () => {
    const { analysis } = await readAdhesion();
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });

    const counterOffers = await draftSoftCounterOffers(analysis.flags, { model });

    expect(analysis.gaps.length).toBe(2);
    const flagIds = new Set(analysis.flags.map((flag) => flag.id));
    for (const counterOffer of counterOffers) {
      expect(flagIds.has(counterOffer.flagId)).toBe(true);
    }
    const gapIds = new Set(analysis.gaps.map((gap) => gap.id));
    for (const counterOffer of counterOffers) {
      expect(gapIds.has(counterOffer.flagId)).toBe(false);
    }

    // Nothing was even asked about a gap: no drafting call carries one of their
    // statements, so there is no reply that could have been kept (ADR-0014).
    const asked = draftingCalls(model.calls)
      .flatMap((call) => call.messages.map((message) => message.content))
      .join('\n');
    for (const gap of analysis.gaps) {
      expect(asked).not.toContain(gap.statement);
    }
  });

  it('cannot be handed a gap at all', async () => {
    const { analysis } = await readAdhesion();
    const gap = analysis.gaps[0];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });

    // Not a lint waiver: a gap reaching `draftCounterOffer` is a compile error,
    // which is what ADR-0014 is enforced with. If a later change made a gap
    // acceptable here, this line would stop erroring and the test would fail.
    // @ts-expect-error a gap has no source sentence and no counter-offer (ADR-0014)
    const impossible = draftCounterOffer(gap, 'soft', { model });
    await impossible.catch(() => undefined);

    // And nothing was drafted for it at runtime either: the reply that came back
    // quotes a statement, not a sentence in the document, so it is refused.
    const counterOffers = await draftSoftCounterOffers(
      // @ts-expect-error same, through the plural seam
      [gap],
      { model },
    );
    expect(counterOffers).toEqual([]);
    warn.mockRestore();
  });

  it('leaves a flag standing when its draft could not be made', async () => {
    const { analysis } = await readAdhesion();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let asked = 0;
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: (request: StructuredRequest) => {
        asked += 1;
        if (asked === 2) throw new ModelCallError('The drafting model is down.');
        return counterOfferFor(request);
      },
    });

    const counterOffers = await draftSoftCounterOffers(analysis.flags, { model });

    expect(counterOffers).toHaveLength(analysis.flags.length - 1);
    expect(counterOffers.map((each) => each.flagId)).not.toContain(
      analysis.flags[1].id,
    );
    warn.mockRestore();
  });
});

describe('counter-offers read back out of a stored row', () => {
  it('keeps the drafts that still belong to a flag of this document', async () => {
    const { analysis } = await readAdhesion();
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });
    const drafted = await draftSoftCounterOffers(analysis.flags, { model });

    const { counterOffers, dropped } = verifyCounterOffers(
      drafted,
      analysis.flags,
    );

    expect(dropped).toEqual([]);
    expect(counterOffers.map((each) => each.flagId)).toEqual(
      drafted.map((each) => each.flagId),
    );
  });

  it('drops a stored draft that names no flag or quotes the wrong sentence', async () => {
    const { analysis } = await readAdhesion();
    const flag = analysis.flags[0];
    const gap = analysis.gaps[0];

    const { counterOffers, dropped } = verifyCounterOffers(
      [
        {
          flagId: gap.id,
          stance: 'soft',
          sourceSentence: 'A sentence nobody ever wrote.',
          text: 'Payment is due within 30 days of invoice.',
        },
        {
          flagId: flag.id,
          stance: 'soft',
          sourceSentence: analysis.flags[1].sourceSentence,
          text: 'The parties agree that this applies only with written consent.',
        },
        {
          flagId: flag.id,
          stance: 'firm',
          sourceSentence: analysis.flags[1].sourceSentence,
          text: 'This clause is struck.',
        },
      ],
      analysis.flags,
    );

    expect(counterOffers).toEqual([]);
    expect(dropped.map((each) => each.flagId)).toEqual([
      gap.id,
      flag.id,
      flag.id,
    ]);
    expect(dropped[0].reason).toContain('names no flag');
    expect(dropped[2].reason).toContain('rewrites a sentence other than');
  });

  it('keeps the firm draft a reader asked for, beside the soft one', async () => {
    const { analysis } = await readAdhesion();
    const flag = analysis.flags[0];

    const { counterOffers, dropped } = verifyCounterOffers(
      [
        {
          flagId: flag.id,
          stance: 'soft',
          sourceSentence: flag.sourceSentence,
          text: 'The parties agree that this applies only with written consent.',
        },
        {
          flagId: flag.id,
          stance: 'firm',
          sourceSentence: flag.sourceSentence,
          text: 'This clause applies only where the reader has agreed to it in writing.',
        },
        {
          flagId: flag.id,
          stance: 'firm',
          sourceSentence: flag.sourceSentence,
          text: 'A second firm draft of the same clause.',
        },
      ],
      analysis.flags,
    );

    expect(counterOffers.map((each) => each.stance)).toEqual(['soft', 'firm']);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toContain('already has a firm counter-offer');
  });
});

describe('the type of what may be rewritten', () => {
  it('accepts a verified flag and rejects the shape a gap has', async () => {
    const { analysis } = await readAdhesion();

    const rewritable: ClauseToRewrite = analysis.flags[0];
    expect(rewritable.sourceSentence.length).toBeGreaterThan(0);

    // @ts-expect-error a gap carries a statement and no source sentence
    const notRewritable: ClauseToRewrite = analysis.gaps[0];
    expect(notRewritable.statement).toBeDefined();
  });
});
