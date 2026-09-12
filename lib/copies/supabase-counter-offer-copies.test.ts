import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import { draftSoftCounterOffers } from '../analysis/counter-offer';
import type { AnalysisResult } from '../analysis/types';
import { createSupabaseDocuments } from '../documents/supabase-documents';
import { recordCounterOfferCopy } from './copy-counter-offer';
import { COPY_PROXY_NOTE, CounterOfferCopyError } from './store';
import {
  counterOfferCopyCounts,
  createSupabaseCounterOfferCopies,
  COUNTER_OFFER_COPIES_TABLE,
} from './supabase-counter-offer-copies';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';
const DOCUMENT = '5f4d3c2b-1a09-4e8f-9d7c-6b5a4f3e2d10';
const OTHER_DOCUMENT = '0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

function row(flagId: string, stance: string, documentId = DOCUMENT) {
  return { document_id: documentId, flag_id: flagId, stance };
}

describe('the copies one reader records', () => {
  it('writes the copy under the reader, in the stance it was in', async () => {
    const { client, queries } = createStubSupabase({ rows: [[{ id: 'copy-1' }]] });

    await createSupabaseCounterOfferCopies(client, OWNER).record({
      documentId: DOCUMENT,
      flagId: 'uncapped-indemnity',
      stance: 'firm',
    });

    expect(queries[0].table).toBe(COUNTER_OFFER_COPIES_TABLE);
    expect(queries[0].operation).toBe('insert');
    expect(queries[0].values).toEqual({
      owner_id: OWNER,
      document_id: DOCUMENT,
      flag_id: 'uncapped-indemnity',
      stance: 'firm',
    });
  });

  it('says what went wrong when the database refuses the row', async () => {
    const { client } = createStubSupabase({
      error: 'new row violates row-level security policy',
    });

    await expect(
      createSupabaseCounterOfferCopies(client, OWNER).record({
        documentId: DOCUMENT,
        flagId: 'uncapped-indemnity',
        stance: 'soft',
      }),
    ).rejects.toBeInstanceOf(CounterOfferCopyError);
  });
});

describe('the counts, across every copy recorded', () => {
  it('splits soft from firm and gets both numbers right for a mixed set', async () => {
    const { client, queries } = createStubSupabase({
      rows: [
        [
          row('uncapped-indemnity', 'soft'),
          row('overbroad-non-compete', 'soft'),
          row('overbroad-non-compete', 'soft'),
          row('uncapped-indemnity', 'firm'),
          row('unilateral-change', 'firm'),
          row('uncapped-indemnity', 'soft', OTHER_DOCUMENT),
        ],
      ],
    });

    const counts = await counterOfferCopyCounts(client);

    expect(queries[0].table).toBe(COUNTER_OFFER_COPIES_TABLE);
    // No owner filter: what is being watched is whether the stance default is
    // calibrated, not a person. Row level security is what stops a reader
    // running this, and the table has no select policy at all.
    expect(queries[0].filters).toEqual([]);

    expect(counts.soft).toEqual({ uniqueCounterOffers: 3, copies: 4 });
    expect(counts.firm).toEqual({ uniqueCounterOffers: 2, copies: 2 });
  });

  it('reads four copies of one draft back as one send and four copies', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    const read = await analyzeDocument(text, sidecar.redLines, { model });
    const analysis: AnalysisResult = {
      ...read,
      counterOffers: await draftSoftCounterOffers(read.flags, { model }),
    };
    const flagId = analysis.counterOffers[0].flagId;
    const documentRow = {
      id: DOCUMENT,
      name: sidecar.name,
      extracted_text: text,
      analysis: JSON.parse(JSON.stringify(analysis)),
      created_at: '2026-09-12T09:00:00Z',
      updated_at: '2026-09-12T09:00:00Z',
    };

    // The reader copies the same draft four times, the way anyone fighting with
    // an email client does. Each copy goes the whole way in: the document is
    // read back, the stance comes off the stored draft, a row is written.
    const writing = createStubSupabase({
      rows: Array.from({ length: 8 }, (_, index) =>
        index % 2 === 0 ? [documentRow] : [{ id: `copy-${index}` }],
      ),
    });
    const deps = {
      documents: createSupabaseDocuments(writing.client, OWNER),
      copies: createSupabaseCounterOfferCopies(writing.client, OWNER),
    };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await recordCounterOfferCopy(deps, DOCUMENT, flagId, 'soft');
      expect(result.at).toBe('recorded');
    }

    const written = writing.queries
      .filter((query) => query.operation === 'insert')
      .map((query) => ({
        document_id: query.values?.document_id as string,
        flag_id: query.values?.flag_id as string,
        stance: query.values?.stance as string,
      }));
    expect(written.length).toBe(4);

    const { client } = createStubSupabase({ rows: [written] });
    const counts = await counterOfferCopyCounts(client);

    expect(counts.soft.uniqueCounterOffers).toBe(1);
    expect(counts.soft.copies).toBe(4);
  });

  it('counts no row whose stance is one nobody can choose', async () => {
    const { client } = createStubSupabase({
      rows: [[row('uncapped-indemnity', 'soft'), row('uncapped-indemnity', 'furious')]],
    });

    const counts = await counterOfferCopyCounts(client);

    expect(counts.soft.copies).toBe(1);
    expect(counts.firm.copies).toBe(0);
  });

  it('says the numbers are copies rather than confirmed sends', async () => {
    const { client } = createStubSupabase({ rows: [[row('a', 'soft')]] });

    const counts = await counterOfferCopyCounts(client);

    expect(counts.note).toBe(COPY_PROXY_NOTE);
    expect(counts.note).toMatch(/copies rather than confirmed sends/i);
  });

  it('says what went wrong when the count cannot be read', async () => {
    const { client } = createStubSupabase({ error: 'permission denied' });

    await expect(counterOfferCopyCounts(client)).rejects.toBeInstanceOf(
      CounterOfferCopyError,
    );
  });
});

describe('the migration behind the copies', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '0005_counter_offer_copies.sql'),
    'utf8',
  );

  it('turns row level security on for the table', () => {
    expect(sql).toMatch(
      /alter table public\.counter_offer_copies enable row level security/,
    );
  });

  it('lets a reader write their own rows and nothing else', () => {
    const policy = sql.match(
      /create policy counter_offer_copies_insert_own[\s\S]*?;/i,
    );
    expect(policy).not.toBeNull();
    expect(policy?.[0]).toContain('to authenticated');
    expect(policy?.[0]).toMatch(/owner_id = \(select auth\.uid\(\)\)/);

    for (const other of ['select', 'update', 'delete']) {
      expect(sql).not.toMatch(new RegExp(`create policy[\\s\\S]*?for ${other}\\b`, 'i'));
    }
    for (const written of sql.matchAll(/create policy[\s\S]*?;/gi)) {
      expect(written[0]).not.toMatch(/\bto [^\n]*\banon\b/);
    }
  });

  it('takes the copy with the account, the document and a stance a reader can choose', () => {
    expect(sql).toMatch(
      /owner_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    expect(sql).toMatch(
      /document_id uuid not null references public\.documents \(id\) on delete cascade/,
    );
    expect(sql).toMatch(/stance text not null check \(stance in \('soft', 'firm'\)\)/);
  });

  it('keeps every repeat copy as its own row', () => {
    expect(sql).not.toMatch(/unique \(document_id, flag_id, stance\)/);
    expect(sql).toMatch(/no unique constraint/i);
  });

  it('puts the counts where an ordinary signed-in reader cannot reach them', () => {
    expect(sql).toMatch(/create schema if not exists metrics/);
    expect(sql).toMatch(/revoke all on schema metrics from anon, authenticated/);
    const view = sql.match(
      /create or replace view metrics\.counter_offer_copies_by_stance[\s\S]*?;\n/i,
    );
    expect(view).not.toBeNull();
    expect(view?.[0]).toContain('security_invoker = on');
  });

  it('reports unique drafts and raw copies, soft and firm apart', () => {
    const view = sql.match(
      /create or replace view metrics\.counter_offer_copies_by_stance[\s\S]*?;\n/i,
    )?.[0];
    expect(view).toContain('soft_unique_counter_offers_copied');
    expect(view).toContain('soft_copies');
    expect(view).toContain('firm_unique_counter_offers_copied');
    expect(view).toContain('firm_copies');
  });

  it('never calls a count sent, on the table or on the view', () => {
    for (const comment of sql.matchAll(/comment on [\s\S]*?;/gi)) {
      expect(comment[0]).toMatch(/copie[sd]/i);
    }
    expect(sql).not.toMatch(/\bas [a-z_]*sent\b/i);
    const view = sql.match(
      /create or replace view metrics\.counter_offer_copies_by_stance[\s\S]*?;\n/i,
    )?.[0];
    expect(view).not.toMatch(/\bsent\b/i);
  });

  it('says on the table itself that a copy is a proxy for a send', () => {
    const comment = sql.match(
      /comment on table public\.counter_offer_copies is[\s\S]*?;/i,
    );
    expect(comment?.[0]).toMatch(/proxy/i);
    expect(comment?.[0]).toMatch(/not a count of confirmed sends/i);
  });
});
