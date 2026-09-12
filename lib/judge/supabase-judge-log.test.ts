import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { JudgeLogError, JUDGE_SIGNAL_NOTE } from './store';
import { createSupabaseJudgeLog, JUDGE_LOG_TABLE } from './supabase-judge-log';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';

const RED_LINE = 'I will not give up the right to show this work in my portfolio.';
const SENTENCE =
  'Contractor shall not disclose, display, or reference the Deliverables or the existence of this Agreement without Client’s prior written consent.';
const REASONING =
  'The sentence stops the reader showing the work to anyone, which is the thing their red line says they keep.';

describe('the judge log, written during a run', () => {
  it('writes a review under the reader whose run produced it', async () => {
    const { client, queries } = createStubSupabase({ rows: [[{ id: 'review-1' }]] });

    await createSupabaseJudgeLog(client, OWNER).record({
      redLine: RED_LINE,
      sourceSentence: SENTENCE,
      fits: false,
      reasoning: REASONING,
    });

    expect(queries[0].table).toBe(JUDGE_LOG_TABLE);
    expect(queries[0].operation).toBe('insert');
    expect(queries[0].values).toEqual({
      owner_id: OWNER,
      red_line: RED_LINE,
      source_sentence: SENTENCE,
      fits: false,
      reasoning: REASONING,
    });
  });

  it('says what went wrong when the database refuses the row', async () => {
    const { client } = createStubSupabase({
      error: 'new row violates row-level security policy',
    });

    await expect(
      createSupabaseJudgeLog(client, OWNER).record({
        redLine: RED_LINE,
        sourceSentence: SENTENCE,
        fits: true,
        reasoning: REASONING,
      }),
    ).rejects.toBeInstanceOf(JudgeLogError);
  });

  it('reads the agreement rate from the rows themselves, with what it is worth', async () => {
    const { client, queries } = createStubSupabase({
      rows: [[{ fits: true }, { fits: false }, { fits: true }, { fits: true }]],
    });

    const rate = await createSupabaseJudgeLog(client, OWNER).rate();

    expect(queries[0].operation).toBe('select');
    expect(queries[0].columns).toBe('fits, created_at');
    expect(rate.reviewed).toBe(4);
    expect(rate.agreed).toBe(3);
    expect(rate.disagreed).toBe(1);
    expect(rate.agreementRate).toBeCloseTo(0.75);
    expect(rate.note).toBe(JUDGE_SIGNAL_NOTE);
  });

  it('reads the rate across readers rather than one reader’s own rows', async () => {
    const { client, queries } = createStubSupabase({ rows: [[{ fits: true }]] });

    await createSupabaseJudgeLog(client, OWNER).rate();

    // No owner filter, on purpose: the audit is about the matcher, not about a
    // person, and the migration is what stops a reader running this query at all.
    expect(queries[0].filters).toEqual([]);
  });

  it('says what went wrong when the rate cannot be read', async () => {
    const { client } = createStubSupabase({ error: 'permission denied' });

    await expect(
      createSupabaseJudgeLog(client, OWNER).rate(),
    ).rejects.toBeInstanceOf(JudgeLogError);
  });
});

describe('the migration that keeps the judge log out of the reader’s reach', () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      'supabase',
      'migrations',
      '0003_red_line_match_judgments.sql',
    ),
    'utf8',
  );

  it('turns row level security on for the table', () => {
    expect(sql).toMatch(
      /alter table public\.red_line_match_judgments enable row level security/,
    );
  });

  it('lets a run write only its own rows', () => {
    const policy = sql.match(
      /create policy red_line_match_judgments_insert_own[\s\S]*?;/i,
    );
    expect(policy).not.toBeNull();
    expect(policy?.[0]).toContain('for insert');
    expect(policy?.[0]).toContain('to authenticated');
    expect(policy?.[0]).toMatch(/owner_id = \(select auth\.uid\(\)\)/);
  });

  it('gives no session any way to read the judge’s verdict back', () => {
    // The ADR-0019 requirement stated where it can be enforced: with no select
    // policy there is no query a screen could put behind the reader's flag.
    for (const operation of ['select', 'update', 'delete']) {
      expect(sql).not.toMatch(
        new RegExp(`create policy[\\s\\S]*?for ${operation}\\b`, 'i'),
      );
    }
    expect(sql).not.toMatch(/to anon/);
  });

  it('counts both sides of the ratio in the view the audit reads', () => {
    const view = sql.match(
      /create or replace view public\.red_line_judge_agreement_rate[\s\S]*?;/i,
    );
    expect(view).not.toBeNull();
    expect(view?.[0]).toContain('security_invoker = on');
    expect(view?.[0]).toMatch(/count\(\*\) filter \(where fits\) as agreed/);
    expect(view?.[0]).toMatch(/count\(\*\) filter \(where not fits\) as disagreed/);
    expect(view?.[0]).toContain('agreement_rate');
    expect(view?.[0]).toContain('disagreement_rate');
  });

  it('ties a row to an account that still exists', () => {
    expect(sql).toMatch(
      /owner_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
  });

  it('says on the table itself that the judge is a signal, not proof', () => {
    const comment = sql.match(
      /comment on table public\.red_line_match_judgments is[\s\S]*?;/i,
    );
    expect(comment?.[0]).toMatch(/not proof/i);
  });
});
