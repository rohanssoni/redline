import type {
  FinishedRead,
  ZeroFlagLogGateway,
} from '../../lib/zero-flag/store';

/**
 * A zero-flag log that keeps its rows in memory. It stands in for the Supabase
 * table, which is one of the two things the suite is allowed to stub, so that
 * everything between a finished read and the row written runs for real.
 */
export interface StubZeroFlagLog extends ZeroFlagLogGateway {
  /** Every finished read written, in order. */
  written: Array<Pick<FinishedRead, 'cleanRead'>>;
  /** Makes the log refuse, the way a database that is down does. */
  fail(message: string): void;
}

export function createStubZeroFlagLog(): StubZeroFlagLog {
  const written: Array<Pick<FinishedRead, 'cleanRead'>> = [];
  let failure: string | null = null;

  return {
    written,
    fail(message: string) {
      failure = message;
    },
    async record(read: Pick<FinishedRead, 'cleanRead'>): Promise<void> {
      if (failure) throw new Error(failure);
      written.push({ cleanRead: read.cleanRead });
    },
  };
}
