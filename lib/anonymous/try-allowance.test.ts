import { describe, expect, it } from 'vitest';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import {
  ANONYMOUS_TRIES_TABLE,
  allowanceFor,
  callerAddress,
  callerKey,
  createSupabaseTryAllowance,
} from './try-allowance';
import {
  ANONYMOUS_TRIES_PER_DAY,
  DAILY_LIMIT_REASON,
  LIMIT_UNAVAILABLE_REASON,
  utcDay,
  withinDailyLimit,
} from './try-limits';

const NOW = new Date('2026-03-04T23:30:00.000Z');
const KEY = callerKey('198.51.100.4');

function usedTries(count: number): unknown[] {
  return Array.from({ length: count }, (_, at) => ({ id: `try-${at}` }));
}

describe('the daily rule itself', () => {
  it('allows three tries and no fourth', () => {
    expect(ANONYMOUS_TRIES_PER_DAY).toBe(3);
    expect(withinDailyLimit(0)).toBe(true);
    expect(withinDailyLimit(2)).toBe(true);
    expect(withinDailyLimit(3)).toBe(false);
    expect(withinDailyLimit(9)).toBe(false);
  });

  it('counts by UTC day, so the count turns over at one moment for everybody', () => {
    expect(utcDay(new Date('2026-03-04T23:59:59.000Z'))).toBe('2026-03-04');
    expect(utcDay(new Date('2026-03-05T00:00:01.000Z'))).toBe('2026-03-05');
  });
});

describe('the caller a try is counted against', () => {
  it('never puts the address itself in a row', () => {
    const key = callerKey('198.51.100.4');

    expect(key).not.toContain('198.51.100.4');
    expect(key).toHaveLength(64);
    expect(callerKey('198.51.100.4')).toBe(key);
    expect(callerKey('198.51.100.5')).not.toBe(key);
  });

  it('counts callers with no address in one shared bucket rather than none', () => {
    expect(callerKey(null)).toBe(callerKey('   '));
  });

  it('takes the first address a proxy forwarded', () => {
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.4, 10.0.0.1',
      'x-real-ip': '10.0.0.1',
    });

    expect(callerAddress(headers)).toBe('198.51.100.4');
    expect(callerAddress(new Headers({ 'x-real-ip': '10.0.0.2' }))).toBe(
      '10.0.0.2',
    );
    expect(callerAddress(new Headers())).toBeNull();
  });
});

describe('claiming a try against the count', () => {
  it('counts today’s rows for this caller and records the new one', async () => {
    const supabase = createStubSupabase({ rows: [usedTries(1), [{ id: 'new' }]] });

    const outcome = await createSupabaseTryAllowance(supabase.client, {
      key: KEY,
      now: NOW,
    }).claim();

    expect(outcome.allowed).toBe(true);
    expect(supabase.queries[0].table).toBe(ANONYMOUS_TRIES_TABLE);
    expect(supabase.queries[0].operation).toBe('select');
    expect(supabase.queries[0].filters).toEqual([
      ['caller_key', KEY],
      ['day', '2026-03-04'],
    ]);
    expect(supabase.queries[1].operation).toBe('insert');
    expect(supabase.queries[1].values).toEqual({
      caller_key: KEY,
      day: '2026-03-04',
    });
  });

  it('refuses the fourth try of the day and records nothing', async () => {
    const supabase = createStubSupabase({
      rows: [usedTries(ANONYMOUS_TRIES_PER_DAY)],
    });

    const outcome = await createSupabaseTryAllowance(supabase.client, {
      key: KEY,
      now: NOW,
    }).claim();

    expect(outcome).toEqual({ allowed: false, reason: DAILY_LIMIT_REASON });
    expect(supabase.queries).toHaveLength(1);
  });

  it('fails closed when the count cannot be read', async () => {
    const supabase = createStubSupabase({ error: 'the database is down' });

    const outcome = await createSupabaseTryAllowance(supabase.client, {
      key: KEY,
      now: NOW,
    }).claim();

    expect(outcome).toEqual({
      allowed: false,
      reason: LIMIT_UNAVAILABLE_REASON,
    });
  });
});

describe('who the limit is for', () => {
  it('does not meter a signed-in reader, and asks the database nothing', async () => {
    const supabase = createStubSupabase();

    const outcome = await allowanceFor({
      supabase: supabase.client,
      signedIn: true,
      address: '198.51.100.4',
      now: NOW,
    }).claim();

    expect(outcome.allowed).toBe(true);
    expect(supabase.queries).toEqual([]);
  });

  it('meters a visitor with no account', async () => {
    const supabase = createStubSupabase({ rows: [[], [{ id: 'new' }]] });

    const outcome = await allowanceFor({
      supabase: supabase.client,
      signedIn: false,
      address: '198.51.100.4',
      now: NOW,
    }).claim();

    expect(outcome.allowed).toBe(true);
    expect(supabase.queries[0].filters).toEqual([
      ['caller_key', KEY],
      ['day', '2026-03-04'],
    ]);
  });

  it('lets a copy with no project configured read, because there is no count to keep', async () => {
    const outcome = await allowanceFor({
      supabase: null,
      signedIn: false,
      address: '198.51.100.4',
      now: NOW,
    }).claim();

    expect(outcome.allowed).toBe(true);
  });
});
