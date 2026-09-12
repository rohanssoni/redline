import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { importsReachedFrom } from '../../tests/support/import-graph';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import {
  createStubModelClient,
  stubModelClientFor,
} from '../../tests/support/stub-model-client';
import {
  containsSourceSentence,
  findSourceSentence,
} from '../analysis/source-sentence';
import { openFromLibrary } from '../documents/library';
import { createSupabaseDocuments } from '../documents/supabase-documents';
import { CITATIONS_LOST_REASON, keepTriedDocument } from './keep-try';
import { unmeteredTries } from './try-allowance';
import { tryDocument, type AnonymousRead } from './try-document';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';
const NAME = 'Halverson agreement.pdf';
const WHEN = '2026-09-12T10:00:00Z';

/**
 * A try that has happened, in the state the tab is holding it: the text that
 * was analysed and the read, both after a trip through JSON, because that is
 * how they reach the browser and how they go back.
 */
async function triedInTheTab() {
  const { text, sidecar } = loadAdhesionFixture();
  const model = stubModelClientFor(sidecar);
  const outcome = await tryDocument({ model, allowance: unmeteredTries() }, text);

  expect(outcome.read).toBeDefined();
  expect(outcome.read!.flags.length).toBeGreaterThan(0);

  return {
    sidecar,
    model,
    analysed: outcome.text as string,
    read: JSON.parse(JSON.stringify(outcome.read)) as AnonymousRead,
  };
}

function rowFor(analysis: unknown, text: string, id = 'doc-kept') {
  return {
    id,
    name: NAME,
    extracted_text: text,
    analysis,
    created_at: WHEN,
    updated_at: WHEN,
  };
}

/** The two rows a successful keep gets back: the insert, then the update. */
function rowsForKeeping(read: AnonymousRead, stored: string, written = stored) {
  return [[rowFor(null, written)], [rowFor(read, written)]];
}

describe('keeping a try by making an account', () => {
  it('saves the text and the read to the new account’s library', async () => {
    const { analysed, read, sidecar } = await triedInTheTab();
    const { client, queries } = createStubSupabase({
      rows: rowsForKeeping(read, analysed),
    });

    const outcome = await keepTriedDocument(
      { documents: createSupabaseDocuments(client, OWNER) },
      { name: NAME, text: analysed, analysis: read },
    );

    expect(outcome.refused).toBeUndefined();
    expect(outcome.id).toBe('doc-kept');

    const insert = queries.find((query) => query.operation === 'insert');
    expect(insert?.table).toBe('documents');
    expect(insert?.values?.owner_id).toBe(OWNER);
    expect(insert?.values?.name).toBe(NAME);

    const update = queries.find((query) => query.operation === 'update');
    const analysis = update?.values?.analysis as {
      summary: string;
      flags: { id: string }[];
    };
    expect(analysis.summary).toBe(sidecar.summary);
    expect(analysis.flags.map((flag) => flag.id)).toEqual(
      read.flags.map((flag) => flag.id),
    );
    expect(queries.some((query) => query.operation === 'delete')).toBe(false);
  });

  it('makes no model call anywhere on the save path', async () => {
    const { analysed, read, model } = await triedInTheTab();
    const duringTheTry = model.calls.length;
    expect(duringTheTry).toBeGreaterThan(0);

    // A model client that is built, reachable and answers nothing. Keeping the
    // document must not want it: the read already happened, in the tab.
    const idle = createStubModelClient();
    const { client } = createStubSupabase({ rows: rowsForKeeping(read, analysed) });

    const outcome = await keepTriedDocument(
      { documents: createSupabaseDocuments(client, OWNER) },
      { name: NAME, text: analysed, analysis: read },
    );

    expect(outcome.id).toBe('doc-kept');
    expect(idle.calls).toHaveLength(0);
    expect(model.calls).toHaveLength(duringTheTry);
  });

  it('cannot reach a model at all, by its imports', () => {
    // The walk goes through the store and the gateway under the save, so a
    // model client pulled in anywhere beneath it would show up here.
    const beneath = importsReachedFrom('lib/anonymous/keep-try.ts');
    expect(beneath.some((file) => file.endsWith('store.ts'))).toBe(true);

    for (const seed of [
      'lib/anonymous/keep-try.ts',
      'lib/anonymous/keep-request.ts',
      'app/api/try/keep/route.ts',
      'app/try/keep-form.tsx',
      'app/try/actions.ts',
    ]) {
      for (const reached of importsReachedFrom(seed)) {
        expect(reached, `${seed} reaches ${reached}`).not.toMatch(
          /[\\/]lib[\\/]model[\\/]/,
        );
      }
    }
  });
});

describe('the text that is stored', () => {
  it('is the analysed text character for character, and every flag still quotes it', async () => {
    const { analysed, read } = await triedInTheTab();
    const { client, queries } = createStubSupabase({
      rows: rowsForKeeping(read, analysed),
    });

    await keepTriedDocument(
      { documents: createSupabaseDocuments(client, OWNER) },
      { name: NAME, text: analysed, analysis: read },
    );

    const stored = queries.find((query) => query.operation === 'insert')?.values
      ?.extracted_text as string;
    expect(stored).toBe(analysed);

    for (const flag of read.flags) {
      expect(containsSourceSentence(stored, flag.sourceSentence)).toBe(true);
      // Not merely found: found as the same characters. This is what a text
      // re-normalised on the way in would break while still passing the line
      // above.
      expect(findSourceSentence(stored, flag.sourceSentence)).toBe(
        flag.sourceSentence,
      );
    }
  });

  it('opens from the library afterwards like any other document', async () => {
    const { analysed, read, sidecar } = await triedInTheTab();
    const keeping = createStubSupabase({ rows: rowsForKeeping(read, analysed) });

    const outcome = await keepTriedDocument(
      { documents: createSupabaseDocuments(keeping.client, OWNER) },
      { name: NAME, text: analysed, analysis: read },
    );
    expect(outcome.id).toBe('doc-kept');

    // The row as the keep left it: the columns it wrote, read back the way the
    // library reads any row.
    const insert = keeping.queries.find((query) => query.operation === 'insert');
    const update = keeping.queries.find((query) => query.operation === 'update');
    const library = createStubSupabase({
      rows: [
        [
          rowFor(
            update?.values?.analysis,
            insert?.values?.extracted_text as string,
            outcome.id,
          ),
        ],
      ],
    });

    const reopened = await openFromLibrary(
      { documents: createSupabaseDocuments(library.client, OWNER) },
      outcome.id as string,
    );

    expect(reopened?.name).toBe(NAME);
    expect(reopened?.text).toBe(analysed);
    expect(reopened?.analysis?.summary).toBe(sidecar.summary);
    expect(reopened?.analysis?.flags.map((flag) => flag.sourceSentence)).toEqual(
      read.flags.map((flag) => flag.sourceSentence),
    );
    expect(reopened?.analysis?.gaps.map((gap) => gap.id)).toEqual(
      read.gaps.map((gap) => gap.id),
    );
    // Nothing was drafted for a visitor, so there is nothing drafted in the
    // row: the signed-in screen drafts against these flags when it is opened.
    expect(reopened?.analysis?.counterOffers).toEqual([]);
  });
});

describe('a read that no longer matches its text', () => {
  it('is refused before anything is written', async () => {
    const { analysed, read } = await triedInTheTab();
    // The sentence one flag quotes, gone from the text being submitted.
    const withoutIt = analysed.replace(read.flags[0].sourceSentence, '');
    expect(withoutIt).not.toBe(analysed);

    const { client, queries } = createStubSupabase({
      rows: rowsForKeeping(read, withoutIt),
    });

    const outcome = await keepTriedDocument(
      { documents: createSupabaseDocuments(client, OWNER) },
      { name: NAME, text: withoutIt, analysis: read },
    );

    expect(outcome.id).toBeUndefined();
    expect(outcome.refused).toBe(CITATIONS_LOST_REASON);
    expect(queries).toEqual([]);
  });

  it('is deleted rather than kept when the round trip changes the text', async () => {
    const { analysed, read } = await triedInTheTab();
    // A row that came back with a sentence wrapped where it was not wrapped
    // before: the sort of drift a re-normalisation on the way in would cause.
    const sentence = read.flags[0].sourceSentence;
    const drifted = analysed.replace(sentence, sentence.replace(' ', '\n'));
    expect(drifted).not.toBe(analysed);

    // And this is why it has to be caught here. Every flag still verifies
    // against the drifted text, so nothing downstream would complain — the
    // reader would simply be shown quotes their document does not contain.
    for (const flag of read.flags) {
      expect(containsSourceSentence(drifted, flag.sourceSentence)).toBe(true);
    }
    expect(findSourceSentence(drifted, sentence)).not.toBe(sentence);

    const { client, queries } = createStubSupabase({
      rows: [[rowFor(null, drifted)], [{ id: 'doc-kept' }]],
    });

    const outcome = await keepTriedDocument(
      { documents: createSupabaseDocuments(client, OWNER) },
      { name: NAME, text: analysed, analysis: read },
    );

    expect(outcome.id).toBeUndefined();
    expect(outcome.refused).toBe(CITATIONS_LOST_REASON);
    expect(outcome.status).toBe(409);
    // The analysis was never written on top of a row that is not the document,
    // and the row itself is gone.
    expect(queries.map((query) => query.operation)).toEqual(['insert', 'delete']);
    expect(queries[1].filters).toContainEqual(['owner_id', OWNER]);
  });

  it('is refused when what the tab sent is not a read at all', async () => {
    const { analysed } = await triedInTheTab();
    const { client, queries } = createStubSupabase({ rows: [[]] });

    const outcome = await keepTriedDocument(
      { documents: createSupabaseDocuments(client, OWNER) },
      { name: NAME, text: analysed, analysis: { summary: 'A summary.' } },
    );

    expect(outcome.id).toBeUndefined();
    expect(outcome.status).toBe(422);
    expect(queries).toEqual([]);
  });
});
