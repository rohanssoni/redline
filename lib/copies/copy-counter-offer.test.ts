import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import { draftSoftCounterOffers } from '../analysis/counter-offer';
import type { AnalysisResult } from '../analysis/types';
import { createSupabaseDocuments } from '../documents/supabase-documents';
import { recordCounterOfferCopy } from './copy-counter-offer';
import {
  createSupabaseCounterOfferCopies,
  COUNTER_OFFER_COPIES_TABLE,
} from './supabase-counter-offer-copies';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';
const DOCUMENT = '5f4d3c2b-1a09-4e8f-9d7c-6b5a4f3e2d10';

async function read(): Promise<{ analysis: AnalysisResult; text: string }> {
  const { text, sidecar } = loadAdhesionFixture();
  const model = stubModelClientFor(sidecar);
  const analysis = await analyzeDocument(text, sidecar.redLines, { model });
  const counterOffers = await draftSoftCounterOffers(analysis.flags, { model });
  return { analysis: { ...analysis, counterOffers }, text };
}

function documentRow(text: string, analysis: AnalysisResult | null) {
  return {
    id: DOCUMENT,
    name: 'Freelance agreement.pdf',
    extracted_text: text,
    analysis: analysis ? JSON.parse(JSON.stringify(analysis)) : null,
    created_at: '2026-09-12T09:00:00Z',
    updated_at: '2026-09-12T09:00:00Z',
  };
}

function depsFor(rows: unknown[][]) {
  const { client, queries } = createStubSupabase({ rows });
  return {
    queries,
    deps: {
      documents: createSupabaseDocuments(client, OWNER),
      copies: createSupabaseCounterOfferCopies(client, OWNER),
    },
  };
}

describe('recording that a counter-offer was copied', () => {
  it('writes the flag, the stance and the document under the reader', async () => {
    const { analysis, text } = await read();
    const drafted = analysis.counterOffers[0];
    const { deps, queries } = depsFor([
      [documentRow(text, analysis)],
      [{ id: 'copy-1' }],
    ]);

    const result = await recordCounterOfferCopy(
      deps,
      DOCUMENT,
      drafted.flagId,
      'soft',
    );

    expect(result).toEqual({
      at: 'recorded',
      copy: {
        documentId: DOCUMENT,
        flagId: drafted.flagId,
        stance: 'soft',
      },
    });
    expect(queries[1].table).toBe(COUNTER_OFFER_COPIES_TABLE);
    expect(queries[1].operation).toBe('insert');
    expect(queries[1].values).toEqual({
      owner_id: OWNER,
      document_id: DOCUMENT,
      flag_id: drafted.flagId,
      stance: 'soft',
    });
  });

  it('takes the stance from the stored draft, not from what the page reported', async () => {
    const { analysis, text } = await read();
    const soft = analysis.counterOffers[0];
    const withFirm: AnalysisResult = {
      ...analysis,
      counterOffers: [...analysis.counterOffers, { ...soft, stance: 'firm' }],
    };
    const { deps, queries } = depsFor([
      [documentRow(text, withFirm)],
      [{ id: 'copy-1' }],
    ]);

    await recordCounterOfferCopy(deps, DOCUMENT, soft.flagId, 'firm');

    expect(queries[1].values?.stance).toBe('firm');
  });

  it('writes nothing when the page claims a stance the read has no draft in', async () => {
    const { analysis, text } = await read();
    const flagId = analysis.counterOffers[0].flagId;
    const { deps, queries } = depsFor([[documentRow(text, analysis)]]);

    const result = await recordCounterOfferCopy(deps, DOCUMENT, flagId, 'firm');

    expect(result.at).toBe('refused');
    expect(queries.some((query) => query.operation === 'insert')).toBe(false);
  });

  it('writes nothing for a gap, however the call is made', async () => {
    const { analysis, text } = await read();
    expect(analysis.gaps.length).toBeGreaterThan(0);
    const { deps, queries } = depsFor([[documentRow(text, analysis)]]);

    const result = await recordCounterOfferCopy(
      deps,
      DOCUMENT,
      analysis.gaps[0].id,
      'soft',
    );

    expect(result.at).toBe('refused');
    expect(queries.some((query) => query.operation === 'insert')).toBe(false);
  });

  it('writes nothing for a flag that is not in this read', async () => {
    const { analysis, text } = await read();
    const { deps, queries } = depsFor([[documentRow(text, analysis)]]);

    const result = await recordCounterOfferCopy(
      deps,
      DOCUMENT,
      'a-flag-from-somewhere-else',
      'soft',
    );

    expect(result.at).toBe('refused');
    expect(queries.some((query) => query.operation === 'insert')).toBe(false);
  });

  it('writes nothing for a document this reader does not have', async () => {
    const { deps, queries } = depsFor([[]]);

    const result = await recordCounterOfferCopy(
      deps,
      DOCUMENT,
      'uncapped-indemnity',
      'soft',
    );

    expect(result.at).toBe('refused');
    expect(queries.length).toBe(1);
  });

  it('writes nothing for a document nobody has read yet', async () => {
    const { text } = await read();
    const { deps, queries } = depsFor([[documentRow(text, null)]]);

    const result = await recordCounterOfferCopy(
      deps,
      DOCUMENT,
      'uncapped-indemnity',
      'soft',
    );

    expect(result.at).toBe('refused');
    expect(queries.some((query) => query.operation === 'insert')).toBe(false);
  });
});
