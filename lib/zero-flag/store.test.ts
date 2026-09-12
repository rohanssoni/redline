import { describe, expect, it } from 'vitest';
import {
  comparisonInForce,
  FIXED_BASELINE,
  ROLLING_WINDOW_READS,
  SWITCHOVER_DAYS,
  SWITCHOVER_READS,
  toFinishedRead,
  zeroFlagRateOf,
  ZERO_FLAG_SIGNAL_NOTE,
  type FinishedRead,
} from './store';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days as milliseconds, so a test can say 90 days without writing the number out. */
const days = (count: number) => count * DAY_MS;

const LAUNCH = new Date('2026-01-01T09:00:00.000Z');

/**
 * A stretch of finished reads, one a minute from `from`, the first `clean` of
 * them coming back as a clean read.
 */
function readsMade(
  count: number,
  clean: number,
  from: Date = LAUNCH,
): FinishedRead[] {
  return Array.from({ length: count }, (_, index) => ({
    cleanRead: index < clean,
    recordedAt: new Date(from.getTime() + index * 60_000).toISOString(),
  }));
}

describe('which comparison is in force', () => {
  it('holds the fixed baseline while neither threshold has been reached', () => {
    expect(comparisonInForce(120, days(30))).toEqual({
      comparison: 'fixed',
      reachedReadCount: false,
      reachedElapsedTime: false,
    });
  });

  it('switches on the read count first, well inside 90 days', () => {
    const decision = comparisonInForce(SWITCHOVER_READS, days(12));

    expect(decision.comparison).toBe('rolling');
    expect(decision.reachedReadCount).toBe(true);
    expect(decision.reachedElapsedTime).toBe(false);
  });

  it('switches on elapsed time first, with barely any reads', () => {
    const decision = comparisonInForce(9, days(SWITCHOVER_DAYS));

    expect(decision.comparison).toBe('rolling');
    expect(decision.reachedReadCount).toBe(false);
    expect(decision.reachedElapsedTime).toBe(true);
  });

  it('holds the fixed baseline one read and one day short of each threshold', () => {
    expect(
      comparisonInForce(SWITCHOVER_READS - 1, days(SWITCHOVER_DAYS - 1)).comparison,
    ).toBe('fixed');
  });

  it('has no elapsed time to go on before anything has been read', () => {
    expect(comparisonInForce(0, null)).toEqual({
      comparison: 'fixed',
      reachedReadCount: false,
      reachedElapsedTime: false,
    });
  });

  it('reports both thresholds where a busy product has run for a quarter', () => {
    const decision = comparisonInForce(SWITCHOVER_READS * 4, days(200));

    expect(decision).toEqual({
      comparison: 'rolling',
      reachedReadCount: true,
      reachedElapsedTime: true,
    });
  });
});

describe('the zero-flag rate before the switchover', () => {
  it('measures the share of reads that came back clean', () => {
    const rate = zeroFlagRateOf(readsMade(40, 10), new Date(LAUNCH.getTime() + days(3)));

    expect(rate.analyzed).toBe(40);
    expect(rate.windowReads).toBe(40);
    expect(rate.windowCleanReads).toBe(10);
    expect(rate.zeroFlagRate).toBe(0.25);
  });

  it('compares it against the fixed 20%', () => {
    const rate = zeroFlagRateOf(readsMade(40, 10), new Date(LAUNCH.getTime() + days(3)));

    expect(rate.comparison).toBe('fixed');
    expect(rate.baseline).toBe(FIXED_BASELINE);
    expect(rate.baseline).toBe(0.2);
    expect(rate.drift).toBeCloseTo(0.05, 10);
  });

  it('shows a filter that has started suppressing everything as drift upwards', () => {
    const rate = zeroFlagRateOf(readsMade(60, 57), new Date(LAUNCH.getTime() + days(5)));

    expect(rate.zeroFlagRate).toBeCloseTo(0.95, 10);
    expect(rate.drift).toBeCloseTo(0.75, 10);
  });

  it('takes launch from the first read recorded', () => {
    const rate = zeroFlagRateOf(readsMade(5, 1), new Date(LAUNCH.getTime() + days(1)));

    expect(rate.launchedAt).toBe(LAUNCH.toISOString());
  });

  it('reports no rate at all before anything has been read', () => {
    const rate = zeroFlagRateOf([], LAUNCH);

    expect(rate.analyzed).toBe(0);
    expect(rate.zeroFlagRate).toBeNull();
    expect(rate.drift).toBeNull();
    expect(rate.launchedAt).toBeNull();
    // The baseline is still the one in force, which is a fact about the rule
    // rather than about the rows.
    expect(rate.comparison).toBe('fixed');
    expect(rate.baseline).toBe(FIXED_BASELINE);
  });
});

describe('the zero-flag rate after the switchover', () => {
  it('compares the recent window against the window before it, not against 20%', () => {
    const older = readsMade(ROLLING_WINDOW_READS, 50);
    const recent = readsMade(
      ROLLING_WINDOW_READS,
      300,
      new Date(LAUNCH.getTime() + days(10)),
    );

    const rate = zeroFlagRateOf(
      [...older, ...recent],
      new Date(LAUNCH.getTime() + days(20)),
    );

    expect(rate.comparison).toBe('rolling');
    expect(rate.analyzed).toBe(ROLLING_WINDOW_READS * 2);
    expect(rate.windowReads).toBe(ROLLING_WINDOW_READS);
    expect(rate.zeroFlagRate).toBeCloseTo(0.6, 10);
    expect(rate.baseline).toBeCloseTo(0.1, 10);
    expect(rate.baseline).not.toBe(FIXED_BASELINE);
    expect(rate.drift).toBeCloseTo(0.5, 10);
  });

  it('measures the rate over the most recent reads once there are more than a window of them', () => {
    const older = readsMade(200, 200);
    const recent = readsMade(
      ROLLING_WINDOW_READS,
      0,
      new Date(LAUNCH.getTime() + days(10)),
    );

    const rate = zeroFlagRateOf(
      [...older, ...recent],
      new Date(LAUNCH.getTime() + days(11)),
    );

    expect(rate.analyzed).toBe(700);
    expect(rate.windowReads).toBe(ROLLING_WINDOW_READS);
    expect(rate.windowCleanReads).toBe(0);
    expect(rate.zeroFlagRate).toBe(0);
    expect(rate.baseline).toBe(1);
  });

  it('says it has no baseline yet where 90 days passed with barely any reads', () => {
    const rate = zeroFlagRateOf(
      readsMade(4, 1),
      new Date(LAUNCH.getTime() + days(SWITCHOVER_DAYS + 2)),
    );

    expect(rate.comparison).toBe('rolling');
    expect(rate.zeroFlagRate).toBe(0.25);
    // Nothing was recorded before the current window, so there is no preceding
    // stretch to compare with, and a zero here would read as "nothing used to
    // come back clean".
    expect(rate.baseline).toBeNull();
    expect(rate.drift).toBeNull();
  });

  it('drives the switchover off the moment it is given, not the real clock', () => {
    const reads = readsMade(4, 1);

    expect(
      zeroFlagRateOf(reads, new Date(LAUNCH.getTime() + days(SWITCHOVER_DAYS - 1)))
        .comparison,
    ).toBe('fixed');
    expect(
      zeroFlagRateOf(reads, new Date(LAUNCH.getTime() + days(SWITCHOVER_DAYS)))
        .comparison,
    ).toBe('rolling');
  });

  it('reads the same rows the same way whatever order they arrive in', () => {
    const reads = readsMade(30, 6);
    const shuffled = [...reads].reverse();

    expect(zeroFlagRateOf(shuffled, new Date(LAUNCH.getTime() + days(1)))).toEqual(
      zeroFlagRateOf(reads, new Date(LAUNCH.getTime() + days(1))),
    );
  });
});

describe('what the number is reported as', () => {
  it('says the share is watched rather than moved', () => {
    const rate = zeroFlagRateOf(readsMade(10, 2), new Date(LAUNCH.getTime() + days(1)));

    expect(rate.note).toBe(ZERO_FLAG_SIGNAL_NOTE);
    expect(rate.note).toMatch(/don’t try to move it/i);
  });

  it('carries the note with the rate wherever the rate goes', () => {
    expect(zeroFlagRateOf([], LAUNCH).note).toBe(ZERO_FLAG_SIGNAL_NOTE);
  });
});

describe('a row on its way back out of the table', () => {
  it('becomes a finished read with the moment it was recorded', () => {
    expect(
      toFinishedRead({
        clean_read: true,
        created_at: '2026-03-04T10:11:12.000Z',
      }),
    ).toEqual({ cleanRead: true, recordedAt: '2026-03-04T10:11:12.000Z' });
  });
});
