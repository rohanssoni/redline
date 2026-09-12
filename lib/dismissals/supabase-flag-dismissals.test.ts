import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import { FlagDismissalError, shownFlagsOf } from './store';
import {
  createSupabaseFlagDismissals,
  flagDismissalRates,
  FLAG_DISMISSALS_TABLE,
} from './supabase-flag-dismissals';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';
const DOCUMENT = '5f4d3c2b-1a09-4e8f-9d7c-6b5a4f3e2d10';

function rowFor(flagId: string, redLineTriggered: boolean, id = 'dismissal-1') {
  return {
    id,
    document_id: DOCUMENT,
    flag_id: flagId,
    red_line_triggered: redLineTriggered,
    created_at: '2026-09-12T10:00:00Z',
  };
}

describe('the flags one reader set aside', () => {
  it('writes the dismissal under the reader, with the red line mark on it', async () => {
    const { client, queries } = createStubSupabase({
      rows: [[rowFor('overbroad-non-compete', true)]],
    });

    await createSupabaseFlagDismissals(client, OWNER).dismiss({
      documentId: DOCUMENT,
      flagId: 'overbroad-non-compete',
      redLineTriggered: true,
    });

    expect(queries[0].table).toBe(FLAG_DISMISSALS_TABLE);
    expect(queries[0].operation).toBe('insert');
    expect(queries[0].values).toEqual({
      owner_id: OWNER,
      document_id: DOCUMENT,
      flag_id: 'overbroad-non-compete',
      red_line_triggered: true,
    });
  });

  it('brings one back by deleting the row, by document, flag and owner', async () => {
    const { client, queries } = createStubSupabase({
      rows: [[{ id: 'dismissal-1' }]],
    });

    const brought = await createSupabaseFlagDismissals(client, OWNER).restore(
      DOCUMENT,
      'overbroad-non-compete',
    );

    expect(queries[0].operation).toBe('delete');
    expect(queries[0].filters).toEqual([
      ['document_id', DOCUMENT],
      ['flag_id', 'overbroad-non-compete'],
      ['owner_id', OWNER],
    ]);
    expect(brought).toBe(true);
  });

  it('says so when there was no dismissal to undo', async () => {
    const { client } = createStubSupabase({ rows: [[]] });

    const brought = await createSupabaseFlagDismissals(client, OWNER).restore(
      DOCUMENT,
      'overbroad-non-compete',
    );

    expect(brought).toBe(false);
  });

  it('reads back one document’s set-aside flags for that reader alone', async () => {
    const { client, queries } = createStubSupabase({
      rows: [
        [
          rowFor('overbroad-non-compete', true),
          rowFor('uncapped-indemnity', false, 'dismissal-2'),
        ],
      ],
    });

    const setAside = await createSupabaseFlagDismissals(
      client,
      OWNER,
    ).forDocument(DOCUMENT);

    expect(queries[0].operation).toBe('select');
    expect(queries[0].filters).toEqual([
      ['document_id', DOCUMENT],
      ['owner_id', OWNER],
    ]);
    expect(setAside.map((flag) => flag.flagId)).toEqual([
      'overbroad-non-compete',
      'uncapped-indemnity',
    ]);
    expect(setAside[0].redLineTriggered).toBe(true);
    expect(setAside[1].redLineTriggered).toBe(false);
  });

  it('says what went wrong when the database refuses the row', async () => {
    const { client } = createStubSupabase({
      error: 'new row violates row-level security policy',
    });

    await expect(
      createSupabaseFlagDismissals(client, OWNER).dismiss({
        documentId: DOCUMENT,
        flagId: 'uncapped-indemnity',
        redLineTriggered: false,
      }),
    ).rejects.toBeInstanceOf(FlagDismissalError);
  });
});

describe('the two rates, counted across every read', () => {
  it('puts the dismissals over the flags that were actually shown, kind by kind', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const analysis = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });
    const shown = shownFlagsOf(DOCUMENT, analysis);
    const ordinary = shown.filter((flag) => !flag.redLineTriggered);
    const triggered = shown.filter((flag) => flag.redLineTriggered);
    expect(triggered.length).toBeGreaterThan(0);

    const { client, queries } = createStubSupabase({
      rows: [
        [
          {
            id: DOCUMENT,
            name: sidecar.name,
            extracted_text: text,
            analysis: JSON.parse(JSON.stringify(analysis)),
            created_at: '2026-09-12T09:00:00Z',
            updated_at: '2026-09-12T09:00:00Z',
          },
        ],
        [
          { document_id: DOCUMENT, flag_id: ordinary[0].flagId },
          { document_id: DOCUMENT, flag_id: triggered[0].flagId },
        ],
      ],
    });

    const rates = await flagDismissalRates(client);

    expect(queries[0].table).toBe('documents');
    expect(queries[1].table).toBe(FLAG_DISMISSALS_TABLE);
    // No owner filter on either: what is being watched is the threshold and the
    // matcher, not a person, and row level security is what stops a reader
    // running this at all.
    expect(queries[0].filters).toEqual([]);
    expect(queries[1].filters).toEqual([]);

    expect(rates.ordinary.shown).toBe(ordinary.length);
    expect(rates.ordinary.dismissed).toBe(1);
    expect(rates.ordinary.dismissalRate).toBeCloseTo(1 / ordinary.length);
    expect(rates.redLineTriggered.shown).toBe(triggered.length);
    expect(rates.redLineTriggered.dismissed).toBe(1);
    expect(rates.redLineTriggered.dismissalRate).toBeCloseTo(
      1 / triggered.length,
    );
  });

  it('counts no gap in either denominator, though the read found gaps', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const analysis = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });
    expect(analysis.gaps.length).toBeGreaterThan(0);

    const { client } = createStubSupabase({
      rows: [
        [
          {
            id: DOCUMENT,
            name: sidecar.name,
            extracted_text: text,
            analysis: JSON.parse(JSON.stringify(analysis)),
            created_at: '2026-09-12T09:00:00Z',
            updated_at: '2026-09-12T09:00:00Z',
          },
        ],
        // A row naming a gap, the way a hand-written one could. It matches no
        // shown flag, so it moves neither rate.
        [{ document_id: DOCUMENT, flag_id: analysis.gaps[0].id }],
      ],
    });

    const rates = await flagDismissalRates(client);

    expect(rates.ordinary.shown + rates.redLineTriggered.shown).toBe(
      analysis.flags.length,
    );
    expect(rates.ordinary.dismissed).toBe(0);
    expect(rates.redLineTriggered.dismissed).toBe(0);
  });

  it('counts nothing from a document that has not been read', async () => {
    const { text } = loadAdhesionFixture();
    const { client } = createStubSupabase({
      rows: [
        [
          {
            id: DOCUMENT,
            name: 'Not read yet',
            extracted_text: text,
            analysis: null,
            created_at: '2026-09-12T09:00:00Z',
            updated_at: '2026-09-12T09:00:00Z',
          },
        ],
        [],
      ],
    });

    const rates = await flagDismissalRates(client);

    expect(rates.ordinary.shown).toBe(0);
    expect(rates.ordinary.dismissalRate).toBeNull();
    expect(rates.redLineTriggered.dismissalRate).toBeNull();
  });

  it('says what went wrong when the count cannot be read', async () => {
    const { client } = createStubSupabase({ error: 'permission denied' });

    await expect(flagDismissalRates(client)).rejects.toBeInstanceOf(
      FlagDismissalError,
    );
  });
});

describe('the migration behind the dismissals', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '0004_flag_dismissals.sql'),
    'utf8',
  );

  it('turns row level security on for the table', () => {
    expect(sql).toMatch(
      /alter table public\.flag_dismissals enable row level security/,
    );
  });

  it('gives a reader their own rows and nobody else’s, on every operation they need', () => {
    for (const operation of ['insert', 'select', 'delete']) {
      const policy = sql.match(
        new RegExp(`create policy flag_dismissals_${operation}_own[\\s\\S]*?;`, 'i'),
      );
      expect(policy, `no ${operation} policy`).not.toBeNull();
      expect(policy?.[0]).toContain('to authenticated');
      expect(policy?.[0]).toMatch(/owner_id = \(select auth\.uid\(\)\)/);
    }
  });

  it('writes no update policy and none for an unauthenticated visitor', () => {
    expect(sql).not.toMatch(/create policy[\s\S]*?for update\b/i);
    for (const policy of sql.matchAll(/create policy[\s\S]*?;/gi)) {
      expect(policy[0]).not.toMatch(/\bto [^\n]*\banon\b/);
    }
  });

  it('keeps one dismissal per flag, so nothing is counted twice', () => {
    expect(sql).toMatch(/unique \(document_id, flag_id\)/);
  });

  it('takes a dismissal with the account and the document it belongs to', () => {
    expect(sql).toMatch(
      /owner_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    expect(sql).toMatch(
      /document_id uuid not null references public\.documents \(id\) on delete cascade/,
    );
  });

  it('puts the rate where an ordinary signed-in reader cannot reach it', () => {
    expect(sql).toMatch(/create schema if not exists metrics/);
    expect(sql).toMatch(/revoke all on schema metrics from anon, authenticated/);
    const view = sql.match(
      /create or replace view metrics\.flag_dismissal_rates[\s\S]*?;\n/i,
    );
    expect(view).not.toBeNull();
    expect(view?.[0]).toContain('security_invoker = on');
  });

  it('reports the two rates apart, and no combined one', () => {
    const view = sql.match(
      /create or replace view metrics\.flag_dismissal_rates[\s\S]*?;\n/i,
    )?.[0];
    expect(view).toContain('ordinary_dismissal_rate');
    expect(view).toContain('red_line_dismissal_rate');
    expect(view).toContain('ordinary_shown');
    expect(view).toContain('red_line_shown');
    expect(view).not.toMatch(/\bas dismissal_rate\b/);
  });

  it('builds its denominator from flags and never from gaps', () => {
    const view = sql.match(
      /create or replace view metrics\.flag_dismissal_rates[\s\S]*?;\n/i,
    )?.[0];
    expect(view).toContain("d.analysis -> 'flags'");
    expect(view).not.toMatch(/->\s*'gaps'/);
  });

  it('says on the table itself that a dismissal is not a defect report', () => {
    const comment = sql.match(
      /comment on table public\.flag_dismissals is[\s\S]*?;/i,
    );
    expect(comment?.[0]).toMatch(/not a defect/i);
  });
});
