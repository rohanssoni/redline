import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A stand-in for the Supabase client, which is the other thing in Redline that
 * reaches outside the process. It records what was asked of it and answers with
 * rows the test provides, so the code between the query and the reader runs for
 * real.
 */

export interface RecordedQuery {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  columns?: string;
  values?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
  order?: [string, { ascending?: boolean } | undefined];
  terminal?: 'single' | 'maybeSingle' | 'list';
}

export interface StubSupabaseOptions {
  /** Rows returned to any query, in order of the queries made. */
  rows?: unknown[][];
  /** An error message returned instead of rows. */
  error?: string;
}

export interface StubSupabase {
  client: SupabaseClient;
  queries: RecordedQuery[];
}

export function createStubSupabase(options: StubSupabaseOptions = {}): StubSupabase {
  const queries: RecordedQuery[] = [];
  const answers = [...(options.rows ?? [])];

  function answer(query: RecordedQuery) {
    if (options.error) {
      return { data: null, error: { message: options.error } };
    }
    const rows = answers.shift() ?? [];
    if (query.terminal === 'list') {
      return { data: rows, error: null };
    }
    return { data: rows[0] ?? null, error: null };
  }

  function builder(query: RecordedQuery) {
    const chain = {
      select(columns: string) {
        query.columns = columns;
        if (query.operation === 'select') query.columns = columns;
        return chain;
      },
      eq(column: string, value: unknown) {
        query.filters.push([column, value]);
        return chain;
      },
      order(column: string, config?: { ascending?: boolean }) {
        query.order = [column, config];
        query.terminal = 'list';
        return Promise.resolve(answer(query));
      },
      single() {
        query.terminal = 'single';
        return Promise.resolve(answer(query));
      },
      maybeSingle() {
        query.terminal = 'maybeSingle';
        return Promise.resolve(answer(query));
      },
    };
    return chain;
  }

  const client = {
    from(table: string) {
      const start = (operation: RecordedQuery['operation']) => {
        const query: RecordedQuery = { table, operation, filters: [] };
        queries.push(query);
        return query;
      };
      return {
        select(columns: string) {
          const query = start('select');
          query.columns = columns;
          return builder(query);
        },
        insert(values: Record<string, unknown>) {
          const query = start('insert');
          query.values = values;
          return builder(query);
        },
        update(values: Record<string, unknown>) {
          const query = start('update');
          query.values = values;
          return builder(query);
        },
        delete() {
          return builder(start('delete'));
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, queries };
}
