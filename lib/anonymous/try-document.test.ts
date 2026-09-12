import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture, loadCleanFixture } from '../../tests/fixtures';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { containsSourceSentence } from '../analysis/source-sentence';
import {
  allowanceFor,
  createSupabaseTryAllowance,
  unmeteredTries,
  type AllowanceOutcome,
  type TryAllowance,
} from './try-allowance';
import {
  ANONYMOUS_TRIES_PER_DAY,
  DAILY_LIMIT_REASON,
  MAXIMUM_DOCUMENT_CHARACTERS,
} from './try-limits';
import { tryDocument } from './try-document';

const NOW = new Date('2026-03-04T11:00:00.000Z');

/** An allowance that records whether it was asked, and answers as told. */
function countingAllowance(outcome: AllowanceOutcome): TryAllowance & {
  claims: number;
} {
  const allowance = {
    claims: 0,
    async claim(): Promise<AllowanceOutcome> {
      allowance.claims += 1;
      return outcome;
    },
  };
  return allowance;
}

describe('a try without an account', () => {
  it('reads the document and ranks what it found', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    const outcome = await tryDocument(
      { model, allowance: unmeteredTries() },
      text,
    );

    expect(outcome.refused).toBeUndefined();
    expect(outcome.read?.summary).toBe(sidecar.summary);
    expect(outcome.read?.flags.length).toBeGreaterThan(0);
    const severities = outcome.read!.flags.map((flag) => flag.severity);
    expect([...severities].sort((a, b) => b - a)).toEqual(severities);
  });

  it('quotes every flag from the text it was sent, word for word', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const outcome = await tryDocument(
      { model: stubModelClientFor(sidecar), allowance: unmeteredTries() },
      text,
    );

    expect(outcome.read!.flags.length).toBeGreaterThan(0);
    for (const flag of outcome.read!.flags) {
      expect(containsSourceSentence(text, flag.sourceSentence)).toBe(true);
    }
  });

  it('runs with no red lines, so it asks the model nothing about them', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    await tryDocument({ model, allowance: unmeteredTries() }, text);

    expect(model.calls.map((call) => call.name)).not.toContain(
      'red_line_matches',
    );
    // The red-line-only clause of the fixture is the one the plausibility filter
    // drops without the reader's own list, and a visitor has no list.
    const redLineOnly = sidecar.decoys.redLineOnly;
    expect(redLineOnly).toBeDefined();
    const quoted = (await tryDocument(
      { model: stubModelClientFor(sidecar), allowance: unmeteredTries() },
      text,
    ))!.read!.flags.map((flag) => flag.sourceSentence);
    expect(quoted).not.toContain(redLineOnly!.sourceSentence);
  });

  it('drafts no counter-offer, because drafting is not part of reading', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    const outcome = await tryDocument(
      { model, allowance: unmeteredTries() },
      text,
    );

    expect(model.calls.map((call) => call.name)).not.toContain('counter_offer');
    expect(Object.keys(outcome.read!)).toEqual([
      'summary',
      'flags',
      'gaps',
      'cleanRead',
    ]);
  });

  it('reaches the clean read on a document with nothing in it to flag', async () => {
    const { text, sidecar } = loadCleanFixture();

    const outcome = await tryDocument(
      { model: stubModelClientFor(sidecar), allowance: unmeteredTries() },
      text,
    );

    expect(outcome.read?.cleanRead).not.toBeNull();
    expect(outcome.read?.flags).toEqual([]);
    expect(outcome.read?.gaps).toEqual([]);
    expect(outcome.read?.summary).toBe(sidecar.summary);
  });
});

describe('what an anonymous try writes down', () => {
  it('writes no document text and no analysis to the database', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const supabase = createStubSupabase({ rows: [[], [{ id: 'try-1' }]] });
    const model = stubModelClientFor(sidecar);

    const outcome = await tryDocument(
      {
        model,
        allowance: allowanceFor({
          supabase: supabase.client,
          signedIn: false,
          address: '203.0.113.7',
          now: NOW,
        }),
      },
      text,
    );

    expect(outcome.read).toBeDefined();

    const written = supabase.queries.filter(
      (query) => query.operation !== 'select',
    );
    for (const query of written) {
      const values = JSON.stringify(query.values ?? {});
      expect(query.table).not.toBe('documents');
      expect(values).not.toContain(text.slice(0, 80));
      expect(values).not.toContain(outcome.read!.summary.slice(0, 40));
      expect(Object.keys(query.values ?? {})).not.toContain('analysis');
      expect(Object.keys(query.values ?? {})).not.toContain('text');
    }

    // The one row the try wrote is the tally, and it holds a digest and a day.
    expect(written).toHaveLength(1);
    expect(Object.keys(written[0].values ?? {}).sort()).toEqual([
      'caller_key',
      'day',
    ]);
  });
});

describe('the limits, both settled before anything is sent to a model', () => {
  it('turns down a document over the maximum length without calling the model', async () => {
    const { sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    const allowance = countingAllowance({ allowed: true });
    const tooLong = 'A clause of the agreement that runs on. '.repeat(2_000);
    expect(tooLong.length).toBeGreaterThan(MAXIMUM_DOCUMENT_CHARACTERS);

    const outcome = await tryDocument({ model, allowance }, tooLong);

    expect(model.calls).toHaveLength(0);
    expect(outcome.read).toBeUndefined();
    expect(outcome.status).toBe(413);
    expect(outcome.refused).toContain('50,000');
    // And it costs the visitor nothing: the length is a fact about the argument,
    // so it is settled before a try is claimed.
    expect(allowance.claims).toBe(0);
  });

  it('turns down a caller over the daily limit without calling the model', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    const used = Array.from({ length: ANONYMOUS_TRIES_PER_DAY }, (_, at) => ({
      id: `try-${at}`,
    }));
    const supabase = createStubSupabase({ rows: [used] });

    const outcome = await tryDocument(
      {
        model,
        allowance: createSupabaseTryAllowance(supabase.client, {
          key: 'caller',
          now: NOW,
        }),
      },
      text,
    );

    expect(model.calls).toHaveLength(0);
    expect(outcome.refused).toBe(DAILY_LIMIT_REASON);
    expect(outcome.status).toBe(429);
    expect(supabase.queries.every((query) => query.operation === 'select')).toBe(
      true,
    );
  });

  it('turns down text too thin to read before either of them', async () => {
    const { sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    const allowance = countingAllowance({ allowed: true });

    const outcome = await tryDocument({ model, allowance }, 'Two words.');

    expect(model.calls).toHaveLength(0);
    expect(allowance.claims).toBe(0);
    expect(outcome.status).toBe(422);
  });
});
