import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { checkRedLine, redLineTexts, RedLineStoreError } from './store';
import { createSupabaseRedLines } from './supabase-red-lines';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';
const OTHER_OWNER = '11111111-2222-3333-4444-555555555555';

const WRITTEN = 'I will not take equity, credit, or exposure in place of money.';
const REWORDED = 'I will not take equity or exposure in place of money.';

function rowFor(text: string, id = 'red-line-1') {
  return {
    id,
    text,
    created_at: '2026-09-11T10:00:00Z',
    updated_at: '2026-09-11T10:00:00Z',
  };
}

describe('the red lines table, for one reader', () => {
  it('adds a red line under the reader who wrote it', async () => {
    const { client, queries } = createStubSupabase({ rows: [[rowFor(WRITTEN)]] });

    const added = await createSupabaseRedLines(client, OWNER).add(WRITTEN);

    expect(queries[0].table).toBe('red_lines');
    expect(queries[0].operation).toBe('insert');
    expect(queries[0].values).toEqual({ owner_id: OWNER, text: WRITTEN });
    expect(added.text).toBe(WRITTEN);
    expect(added.id).toBe('red-line-1');
  });

  it('lists a reader’s own red lines, in the order they wrote them', async () => {
    const { client, queries } = createStubSupabase({
      rows: [[rowFor(WRITTEN), rowFor('I need thirty days’ notice.', 'red-line-2')]],
    });

    const listed = await createSupabaseRedLines(client, OWNER).list();

    expect(queries[0].operation).toBe('select');
    expect(queries[0].filters).toEqual([['owner_id', OWNER]]);
    expect(queries[0].order).toEqual(['created_at', { ascending: true }]);
    expect(redLineTexts(listed)).toEqual([
      WRITTEN,
      'I need thirty days’ notice.',
    ]);
  });

  it('edits a red line by id and by owner, both', async () => {
    const { client, queries } = createStubSupabase({ rows: [[rowFor(REWORDED)]] });

    const edited = await createSupabaseRedLines(client, OWNER).edit(
      'red-line-1',
      REWORDED,
    );

    expect(queries[0].operation).toBe('update');
    expect(queries[0].values?.text).toBe(REWORDED);
    expect(queries[0].filters).toEqual([
      ['id', 'red-line-1'],
      ['owner_id', OWNER],
    ]);
    expect(edited.text).toBe(REWORDED);
  });

  it('deletes a red line by id and by owner, both', async () => {
    const { client, queries } = createStubSupabase({ rows: [[rowFor(WRITTEN)]] });

    const removed = await createSupabaseRedLines(client, OWNER).remove('red-line-1');

    expect(queries[0].operation).toBe('delete');
    expect(queries[0].filters).toEqual([
      ['id', 'red-line-1'],
      ['owner_id', OWNER],
    ]);
    expect(removed).toBe(true);
  });

  it('reads none of another reader’s red lines', async () => {
    const { client, queries } = createStubSupabase({ rows: [[]] });

    const listed = await createSupabaseRedLines(client, OTHER_OWNER).list();

    expect(listed).toEqual([]);
    expect(queries[0].filters).toEqual([['owner_id', OTHER_OWNER]]);
  });

  it('changes nothing when the red line belongs to someone else', async () => {
    const { client, queries } = createStubSupabase({ rows: [[], []] });
    const theirs = createSupabaseRedLines(client, OTHER_OWNER);

    await expect(theirs.edit('red-line-1', REWORDED)).rejects.toBeInstanceOf(
      RedLineStoreError,
    );
    expect(await theirs.remove('red-line-1')).toBe(false);

    for (const query of queries) {
      expect(query.filters).toContainEqual(['owner_id', OTHER_OWNER]);
      expect(query.filters).not.toContainEqual(['owner_id', OWNER]);
    }
  });

  it('says what went wrong when the database refuses', async () => {
    const { client } = createStubSupabase({
      error: 'new row violates row-level security policy for table "red_lines"',
    });

    await expect(
      createSupabaseRedLines(client, OWNER).add(WRITTEN),
    ).rejects.toBeInstanceOf(RedLineStoreError);
  });
});

describe('what the reader is allowed to write', () => {
  it('keeps the reader’s own words and tidies only the whitespace', () => {
    const checked = checkRedLine('  I will not\n  work without a deadline.  ');

    expect(checked).toEqual({ text: 'I will not work without a deadline.' });
  });

  it('refuses an empty red line and says what to do instead', () => {
    const checked = checkRedLine('   \n  ');

    expect(checked).toEqual({
      problem: 'Write the term you won’t accept, in your own words.',
    });
  });

  it('refuses one too long to be a single red line', () => {
    const checked = checkRedLine('x'.repeat(301));

    expect('problem' in checked && checked.problem).toContain('one at a time');
  });
});

describe('the migration that makes those queries safe', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '0002_red_lines.sql'),
    'utf8',
  );

  it('turns row level security on for the table', () => {
    expect(sql).toMatch(/alter table public\.red_lines enable row level security/);
  });

  it('gives a reader their own rows and nobody else’s, on every operation', () => {
    for (const operation of ['select', 'insert', 'update', 'delete']) {
      const policy = new RegExp(
        `create policy red_lines_${operation}_own[\\s\\S]*?;`,
        'i',
      );
      const found = sql.match(policy);
      expect(found, `no ${operation} policy`).not.toBeNull();
      expect(found?.[0]).toContain('to authenticated');
      expect(found?.[0]).toMatch(/owner_id = \(select auth\.uid\(\)\)/);
    }
  });

  it('writes no policy for an unauthenticated visitor', () => {
    expect(sql).not.toMatch(/to anon/);
  });

  it('makes a red line belong to an account that still exists', () => {
    expect(sql).toMatch(
      /owner_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
  });
});
