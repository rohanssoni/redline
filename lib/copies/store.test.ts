import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import { draftSoftCounterOffers } from '../analysis/counter-offer';
import type { AnalysisResult } from '../analysis/types';
import {
  COPY_PROXY_NOTE,
  copiedCounterOfferIn,
  copyCountsOf,
  toCopiedCounterOffer,
  type CopiedCounterOffer,
} from './store';

const DOCUMENT = '5f4d3c2b-1a09-4e8f-9d7c-6b5a4f3e2d10';
const OTHER_DOCUMENT = '0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

/** A real read with the soft draft each flag gets, the way a reader's is. */
async function readWithDrafts(): Promise<AnalysisResult> {
  const { text, sidecar } = loadAdhesionFixture();
  const model = stubModelClientFor(sidecar);
  const analysis = await analyzeDocument(text, sidecar.redLines, { model });
  const counterOffers = await draftSoftCounterOffers(analysis.flags, { model });
  return { ...analysis, counterOffers };
}

describe('the counter-offer a copy names', () => {
  it('finds the draft in the read and takes the stance off it', async () => {
    const analysis = await readWithDrafts();
    expect(analysis.counterOffers.length).toBeGreaterThan(0);
    const drafted = analysis.counterOffers[0];

    const copy = copiedCounterOfferIn(
      DOCUMENT,
      analysis,
      drafted.flagId,
      'soft',
    );

    expect(copy).toEqual({
      documentId: DOCUMENT,
      flagId: drafted.flagId,
      stance: 'soft',
    });
  });

  it('finds nothing for a stance this flag has no draft in, though the page said so', async () => {
    const analysis = await readWithDrafts();
    const flagId = analysis.counterOffers[0].flagId;
    expect(
      analysis.counterOffers.some(
        (counterOffer) =>
          counterOffer.flagId === flagId && counterOffer.stance === 'firm',
      ),
    ).toBe(false);

    expect(copiedCounterOfferIn(DOCUMENT, analysis, flagId, 'firm')).toBeNull();
  });

  it('records firm only where a firm draft was actually made', async () => {
    const analysis = await readWithDrafts();
    const soft = analysis.counterOffers[0];
    const withFirm: AnalysisResult = {
      ...analysis,
      counterOffers: [...analysis.counterOffers, { ...soft, stance: 'firm' }],
    };

    expect(
      copiedCounterOfferIn(DOCUMENT, withFirm, soft.flagId, 'firm'),
    ).toEqual({
      documentId: DOCUMENT,
      flagId: soft.flagId,
      stance: 'firm',
    });
  });

  it('finds nothing for a stance nobody can choose', async () => {
    const analysis = await readWithDrafts();
    const flagId = analysis.counterOffers[0].flagId;

    expect(copiedCounterOfferIn(DOCUMENT, analysis, flagId, 'furious')).toBeNull();
    expect(copiedCounterOfferIn(DOCUMENT, analysis, flagId, '')).toBeNull();
  });

  it('finds nothing for a gap, so a gap has no way into the metric', async () => {
    const analysis = await readWithDrafts();
    expect(analysis.gaps.length).toBeGreaterThan(0);

    for (const gap of analysis.gaps) {
      expect(copiedCounterOfferIn(DOCUMENT, analysis, gap.id, 'soft')).toBeNull();
      expect(copiedCounterOfferIn(DOCUMENT, analysis, gap.id, 'firm')).toBeNull();
    }
  });

  it('finds nothing for a flag this read has never carried', async () => {
    const analysis = await readWithDrafts();

    expect(
      copiedCounterOfferIn(DOCUMENT, analysis, 'a-flag-from-somewhere-else', 'soft'),
    ).toBeNull();
  });
});

describe('counting what was copied', () => {
  const copy = (
    flagId: string,
    stance: 'soft' | 'firm',
    documentId = DOCUMENT,
  ): CopiedCounterOffer => ({ documentId, flagId, stance });

  it('splits soft from firm, and gets both right for a mixed set', () => {
    const counts = copyCountsOf([
      copy('a', 'soft'),
      copy('b', 'soft'),
      copy('b', 'soft'),
      copy('c', 'firm'),
      copy('a', 'firm'),
      copy('a', 'firm'),
      copy('a', 'firm'),
    ]);

    expect(counts.soft).toEqual({ uniqueCounterOffers: 2, copies: 3 });
    expect(counts.firm).toEqual({ uniqueCounterOffers: 2, copies: 4 });
  });

  it('reports four copies of one draft as one send and four copies', () => {
    const counts = copyCountsOf([
      copy('uncapped-indemnity', 'soft'),
      copy('uncapped-indemnity', 'soft'),
      copy('uncapped-indemnity', 'soft'),
      copy('uncapped-indemnity', 'soft'),
    ]);

    expect(counts.soft.uniqueCounterOffers).toBe(1);
    expect(counts.soft.copies).toBe(4);
    expect(counts.firm).toEqual({ uniqueCounterOffers: 0, copies: 0 });
  });

  it('counts the same flag in each stance as two drafts, not one', () => {
    const counts = copyCountsOf([copy('a', 'soft'), copy('a', 'firm')]);

    expect(counts.soft.uniqueCounterOffers).toBe(1);
    expect(counts.firm.uniqueCounterOffers).toBe(1);
  });

  it('does not fold one document’s flag into another document’s', () => {
    const counts = copyCountsOf([
      copy('a', 'soft'),
      copy('a', 'soft', OTHER_DOCUMENT),
    ]);

    expect(counts.soft.uniqueCounterOffers).toBe(2);
    expect(counts.soft.copies).toBe(2);
  });

  it('counts nothing where nothing was copied', () => {
    const counts = copyCountsOf([]);

    expect(counts.soft).toEqual({ uniqueCounterOffers: 0, copies: 0 });
    expect(counts.firm).toEqual({ uniqueCounterOffers: 0, copies: 0 });
  });

  it('says the numbers are copies, and reports no figure called sent', () => {
    const counts = copyCountsOf([copy('a', 'soft')]);

    expect(counts.note).toBe(COPY_PROXY_NOTE);
    expect(counts.note).toMatch(/copies rather than confirmed sends/i);
    expect(Object.keys(counts).sort()).toEqual(['firm', 'note', 'soft']);
    expect(Object.keys(counts.soft).sort()).toEqual([
      'copies',
      'uniqueCounterOffers',
    ]);
  });
});

describe('a row on its way back out of the table', () => {
  it('becomes a copy in the stance the row holds', () => {
    expect(
      toCopiedCounterOffer({
        document_id: DOCUMENT,
        flag_id: 'uncapped-indemnity',
        stance: 'firm',
      }),
    ).toEqual({
      documentId: DOCUMENT,
      flagId: 'uncapped-indemnity',
      stance: 'firm',
    });
  });

  it('is dropped where the row holds a stance nobody can choose', () => {
    expect(
      toCopiedCounterOffer({
        document_id: DOCUMENT,
        flag_id: 'uncapped-indemnity',
        stance: 'furious',
      }),
    ).toBeNull();
  });
});
