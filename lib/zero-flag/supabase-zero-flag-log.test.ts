import { describe, expect, it } from 'vitest';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import {
  ANALYSIS_READS_TABLE,
  createSupabaseZeroFlagLog,
  zeroFlagRate,
} from './supabase-zero-flag-log';
import { FIXED_BASELINE, ZeroFlagRateError, ZERO_FLAG_SIGNAL_NOTE } from './store';

const OWNER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const NOW = new Date('2026-02-01T09:00:00.000Z');

describe('recording a finished read', () => {
  it('writes the clean read against the reader who ran it', async () => {
    const supabase = createStubSupabase({ rows: [[{ id: 'row-1' }]] });

    await createSupabaseZeroFlagLog(supabase.client, OWNER).record({
      cleanRead: true,
    });

    expect(supabase.queries).toHaveLength(1);
    expect(supabase.queries[0].table).toBe(ANALYSIS_READS_TABLE);
    expect(supabase.queries[0].operation).toBe('insert');
    expect(supabase.queries[0].values).toEqual({
      owner_id: OWNER,
      clean_read: true,
    });
  });

  it('writes a flagged read too, because the share needs its denominator', async () => {
    const supabase = createStubSupabase({ rows: [[{ id: 'row-1' }]] });

    await createSupabaseZeroFlagLog(supabase.client, OWNER).record({
      cleanRead: false,
    });

    expect(supabase.queries[0].values).toEqual({
      owner_id: OWNER,
      clean_read: false,
    });
  });

  it('writes nothing about the document itself', async () => {
    const supabase = createStubSupabase({ rows: [[{ id: 'row-1' }]] });

    await createSupabaseZeroFlagLog(supabase.client, OWNER).record({
      cleanRead: true,
    });

    expect(Object.keys(supabase.queries[0].values ?? {}).sort()).toEqual([
      'clean_read',
      'owner_id',
    ]);
  });

  it('says so when the row could not be written', async () => {
    const supabase = createStubSupabase({ error: 'the database is down' });

    await expect(
      createSupabaseZeroFlagLog(supabase.client, OWNER).record({
        cleanRead: true,
      }),
    ).rejects.toBeInstanceOf(ZeroFlagRateError);
  });
});

describe('reading the rate off the table', () => {
  it('counts the rows and compares them against the fixed baseline', async () => {
    const supabase = createStubSupabase({
      rows: [
        [
          { clean_read: false, created_at: '2026-01-20T10:00:00.000Z' },
          { clean_read: true, created_at: '2026-01-21T10:00:00.000Z' },
          { clean_read: false, created_at: '2026-01-22T10:00:00.000Z' },
          { clean_read: false, created_at: '2026-01-23T10:00:00.000Z' },
        ],
      ],
    });

    const rate = await zeroFlagRate(supabase.client, NOW);

    expect(rate.analyzed).toBe(4);
    expect(rate.windowCleanReads).toBe(1);
    expect(rate.zeroFlagRate).toBe(0.25);
    expect(rate.comparison).toBe('fixed');
    expect(rate.baseline).toBe(FIXED_BASELINE);
    expect(rate.launchedAt).toBe('2026-01-20T10:00:00.000Z');
    expect(rate.note).toBe(ZERO_FLAG_SIGNAL_NOTE);
  });

  it('names no owner, because what is watched is the filter and not a person', async () => {
    const supabase = createStubSupabase({ rows: [[]] });

    await zeroFlagRate(supabase.client, NOW);

    expect(supabase.queries[0].table).toBe(ANALYSIS_READS_TABLE);
    expect(supabase.queries[0].operation).toBe('select');
    expect(supabase.queries[0].filters).toEqual([]);
  });

  it('switches to the rolling comparison once 90 days have passed', async () => {
    const supabase = createStubSupabase({
      rows: [
        [
          { clean_read: true, created_at: '2026-01-20T10:00:00.000Z' },
          { clean_read: false, created_at: '2026-01-21T10:00:00.000Z' },
        ],
      ],
    });

    const rate = await zeroFlagRate(
      supabase.client,
      new Date('2026-06-01T10:00:00.000Z'),
    );

    expect(rate.comparison).toBe('rolling');
    expect(rate.baseline).toBeNull();
  });

  it('reports nothing as null rather than zero where no read has been recorded', async () => {
    const supabase = createStubSupabase({ rows: [[]] });

    const rate = await zeroFlagRate(supabase.client, NOW);

    expect(rate.analyzed).toBe(0);
    expect(rate.zeroFlagRate).toBeNull();
    expect(rate.launchedAt).toBeNull();
  });

  it('says so when the rows could not be read', async () => {
    const supabase = createStubSupabase({ error: 'the database is down' });

    await expect(zeroFlagRate(supabase.client, NOW)).rejects.toBeInstanceOf(
      ZeroFlagRateError,
    );
  });
});
