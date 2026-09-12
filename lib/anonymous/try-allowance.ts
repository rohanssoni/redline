import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DAILY_LIMIT_REASON,
  LIMIT_UNAVAILABLE_REASON,
  utcDay,
  withinDailyLimit,
} from './try-limits';

/**
 * Who is allowed one more try without an account, and the count that decides it.
 *
 * The gateway holds a claim and nothing else. It cannot read a document, write
 * one, or reach anything a reader owns: the only table it names is a tally of
 * how many tries an address has had today, and the only two columns it writes
 * are that address's digest and the day.
 */

export const ANONYMOUS_TRIES_TABLE = 'anonymous_tries';

/** A try allowed, or the reason it is not, written for the visitor. */
export type AllowanceOutcome =
  | { allowed: true; reason?: undefined }
  | { allowed: false; reason: string };

export interface TryAllowance {
  /**
   * Takes one try, if there is one to take. Called once per request, before any
   * model call, and it both counts and records — a caller that asked and was
   * allowed has used the try whether or not the read then succeeds.
   */
  claim(): Promise<AllowanceOutcome>;
}

/**
 * The address a try is counted against, as the table holds it: a digest, never
 * the address itself.
 *
 * The digest is not a secret — there are only so many IPv4 addresses and anyone
 * holding the table could work back from one — and it is not pretending to be.
 * What it buys is that a table whose entire purpose is counting does not become
 * a list of the addresses that read an agreement, and that a row exposed by a
 * mistake in a policy exposes a hash of a number rather than a person's
 * connection.
 *
 * A request that arrives with no address at all is counted in one shared bucket.
 * That is deliberate: those callers share three tries a day between them, which
 * is the conservative end of the mistake, rather than each being unlimited.
 */
export function callerKey(address: string | null): string {
  const trimmed = (address ?? '').trim();
  if (trimmed.length === 0) return 'unaddressed';
  return createHash('sha256').update(trimmed).digest('hex');
}

/**
 * The address of whoever is asking, from the headers a proxy sets. `null` when
 * there is nothing to read, which `callerKey` turns into the shared bucket.
 */
export function callerAddress(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || null;
}

/**
 * An allowance that never refuses, for readers the daily limit is not about.
 *
 * Two of them, and they are different situations that happen to want the same
 * answer:
 *
 * - A **signed-in reader**. The limit exists to bound what an anonymous visitor
 *   can spend, and someone with an account is not one.
 * - A copy of Redline with **no Supabase project configured at all**. Nothing
 *   can be counted because there is nothing to count with, and the alternative
 *   would be a copy of the product that cannot read a document at all — which
 *   the build's own constraint rules out. It is the development case, and the
 *   deployment that has a project is the one the limit is for.
 */
export function unmeteredTries(): TryAllowance {
  return {
    async claim(): Promise<AllowanceOutcome> {
      return { allowed: true };
    },
  };
}

/**
 * The daily count, against a configured project.
 *
 * Two queries and no more: how many tries this caller has had today, then the
 * row that records this one. The decision between them is `withinDailyLimit`,
 * which is pure and lives with the number it enforces.
 *
 * **It fails closed.** A project that is configured and then refuses the query
 * is a project that cannot tell anyone how much has been spent today, and the
 * limit is the only thing standing between an anonymous route and unmetered
 * model spend in a product with no payments. So the try is refused and the
 * visitor is told the counter is out, rather than Redline reading documents it
 * cannot count. The same goes for a row that will not insert: a try that was
 * not recorded is a try that can be taken again, and a caller who found that
 * out would have no limit at all.
 */
export function createSupabaseTryAllowance(
  supabase: SupabaseClient,
  caller: { key: string; now: Date },
): TryAllowance {
  const day = utcDay(caller.now);

  return {
    async claim(): Promise<AllowanceOutcome> {
      const { data, error } = await supabase
        .from(ANONYMOUS_TRIES_TABLE)
        .select('id')
        .eq('caller_key', caller.key)
        .eq('day', day)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn(
          'An anonymous try was refused because the day’s count could not be read: %s',
          error.message,
        );
        return { allowed: false, reason: LIMIT_UNAVAILABLE_REASON };
      }

      if (!withinDailyLimit((data ?? []).length)) {
        return { allowed: false, reason: DAILY_LIMIT_REASON };
      }

      const written = await supabase
        .from(ANONYMOUS_TRIES_TABLE)
        .insert({ caller_key: caller.key, day })
        .select('id')
        .single();

      if (written.error) {
        console.warn(
          'An anonymous try was refused because it could not be recorded: %s',
          written.error.message,
        );
        return { allowed: false, reason: LIMIT_UNAVAILABLE_REASON };
      }

      return { allowed: true };
    },
  };
}

/**
 * Which allowance this request gets. The whole of the decision, in one pure
 * function, so what the limit applies to can be read in one place.
 */
export function allowanceFor(request: {
  /** `null` where no Supabase project is configured. */
  supabase: SupabaseClient | null;
  /** Whether somebody with an account is asking. */
  signedIn: boolean;
  /** The caller's address, hashed before it reaches a row. */
  address: string | null;
  now: Date;
}): TryAllowance {
  if (request.signedIn || !request.supabase) return unmeteredTries();
  return createSupabaseTryAllowance(request.supabase, {
    key: callerKey(request.address),
    now: request.now,
  });
}
