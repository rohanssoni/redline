import { describe, expect, it, vi } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import {
  counterOfferFor,
  createStubModelClient,
  stubModelClientFor,
} from '../../tests/support/stub-model-client';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import {
  DocumentStoreError,
  toDocumentListing,
  toStoredDocument,
  type DocumentRow,
  type DocumentsGateway,
} from '../documents/store';
import { createSupabaseDocuments } from '../documents/supabase-documents';
import { createSupabaseRedLines } from '../red-lines/supabase-red-lines';
import type { StructuredRequest } from '../model/client';
import { COUNTER_OFFER_CALL_NAME } from './counter-offer';
import { FIRM_DRAFT_FAILED, firmCounterOffer } from './firm-counter-offer';
import { readDocument } from './read-document';
import type { AnalysisResult } from './types';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';

/** Through JSON, the way the jsonb column carries an analysis. */
function json<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function documentRow(text: string, analysis: unknown = null): DocumentRow {
  return {
    id: 'doc-1',
    name: 'Halverson agreement.pdf',
    extracted_text: text,
    analysis,
    created_at: '2026-09-11T10:00:00Z',
    updated_at: '2026-09-11T10:00:00Z',
  };
}

/**
 * The reader's library, holding rows the way the column does: what goes in is
 * serialised, and what comes back out goes through the same checks the Supabase
 * gateway puts a row through. Reopening a document later is reading the row
 * again, so that is what a second gateway over the same rows is.
 */
function storedLibrary(initial: DocumentRow) {
  const rows = new Map<string, DocumentRow>([[initial.id, initial]]);

  const documents: DocumentsGateway = {
    async create({ name, text }) {
      const row: DocumentRow = { ...documentRow(text), id: `doc-${rows.size + 1}`, name };
      rows.set(row.id, row);
      return toStoredDocument(json(row));
    },
    async byId(id) {
      const row = rows.get(id);
      return row ? toStoredDocument(json(row)) : null;
    },
    async list() {
      return [...rows.values()].map((row) => toDocumentListing(row));
    },
    async recordAnalysis(id, analysis: AnalysisResult) {
      const row = rows.get(id);
      if (!row) throw new DocumentStoreError('That row is not in the library.');
      const written: DocumentRow = {
        ...row,
        analysis: json(analysis),
        updated_at: '2026-09-11T11:00:00Z',
      };
      rows.set(id, written);
      return toStoredDocument(json(written));
    },
  };

  return { documents, rows };
}

/** The drafting calls a stub was asked to answer, in the order they were made. */
function draftingCalls(calls: readonly StructuredRequest[]): StructuredRequest[] {
  return calls.filter((call) => call.name === COUNTER_OFFER_CALL_NAME);
}

/** What a drafting call actually sent, system prompt and all. */
function sent(call: StructuredRequest): string {
  return call.messages.map((message) => message.content).join('\n');
}

describe('a read leaves only the soft counter-offer behind', () => {
  it('drafts soft for every flag and firm for none', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({
      rows: [[documentRow(text)], [], [documentRow(text)]],
    });
    const model = stubModelClientFor(sidecar);

    await readDocument(
      {
        documents: createSupabaseDocuments(client, OWNER),
        redLines: createSupabaseRedLines(client, OWNER),
        model,
      },
      'doc-1',
    );

    const written = queries[2].values?.analysis as AnalysisResult;
    const drafts = draftingCalls(model.calls);

    expect(written.flags.length).toBeGreaterThan(1);
    expect(drafts).toHaveLength(written.flags.length);
    // The call log, not the result: nothing asked the model for a firm draft.
    expect(drafts.every((call) => sent(call).includes('The stance is soft.'))).toBe(
      true,
    );
    expect(drafts.some((call) => sent(call).includes('The stance is firm.'))).toBe(
      false,
    );

    for (const flag of written.flags) {
      const forFlag = written.counterOffers.filter(
        (each) => each.flagId === flag.id,
      );
      expect(forFlag.map((each) => each.stance)).toEqual(['soft']);
    }
  });
});

describe('switching one flag to firm', () => {
  async function library() {
    const { text, sidecar } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({
      rows: [[documentRow(text)], [], [documentRow(text)]],
    });
    await readDocument(
      {
        documents: createSupabaseDocuments(client, OWNER),
        redLines: createSupabaseRedLines(client, OWNER),
        model: stubModelClientFor(sidecar),
      },
      'doc-1',
    );
    const analysis = queries[2].values?.analysis as AnalysisResult;
    const stored = storedLibrary(documentRow(text, json(analysis)));
    const read = (await stored.documents.byId('doc-1')) as NonNullable<
      Awaited<ReturnType<DocumentsGateway['byId']>>
    >;
    return { ...stored, text, analysis: read.analysis as AnalysisResult };
  }

  it('drafts the firm version for that flag, anchored to its own sentence', async () => {
    const { documents, analysis } = await library();
    const flag = analysis.flags[0];
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });

    const result = await firmCounterOffer({ documents, model }, 'doc-1', flag.id);

    expect(result.at).toBe('drafted');
    if (result.at !== 'drafted') return;
    expect(result.counterOffer.stance).toBe('firm');
    expect(result.counterOffer.flagId).toBe(flag.id);
    expect(result.counterOffer.sourceSentence).toBe(flag.sourceSentence);
    expect(result.counterOffer.text.length).toBeGreaterThan(0);

    const [request] = draftingCalls(model.calls);
    expect(draftingCalls(model.calls)).toHaveLength(1);
    expect(sent(request)).toContain('The stance is firm.');
    expect(sent(request)).toContain(flag.sourceSentence);
    for (const other of analysis.flags.slice(1)) {
      expect(sent(request)).not.toContain(other.sourceSentence);
    }
  });

  it('leaves every other flag with the soft draft it had', async () => {
    const { documents, analysis } = await library();
    const flag = analysis.flags[0];
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });

    await firmCounterOffer({ documents, model }, 'doc-1', flag.id);

    const reopened = await documents.byId('doc-1');
    const kept = reopened?.analysis?.counterOffers ?? [];
    for (const other of analysis.flags.slice(1)) {
      expect(
        kept.filter((each) => each.flagId === other.id).map((each) => each.stance),
      ).toEqual(['soft']);
    }
    expect(
      kept.filter((each) => each.flagId === flag.id).map((each) => each.stance),
    ).toEqual(['soft', 'firm']);
  });

  it('keeps the soft draft for that flag alongside the firm one', async () => {
    const { documents, analysis } = await library();
    const flag = analysis.flags[0];
    const soft = analysis.counterOffers.find(
      (each) => each.flagId === flag.id && each.stance === 'soft',
    );
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });

    await firmCounterOffer({ documents, model }, 'doc-1', flag.id);

    const reopened = await documents.byId('doc-1');
    const stillSoft = reopened?.analysis?.counterOffers.find(
      (each) => each.flagId === flag.id && each.stance === 'soft',
    );
    expect(stillSoft?.text).toBe(soft?.text);
  });

  it('refuses a firm draft that rewrote a different clause, exactly as a soft one is', async () => {
    const { documents, analysis } = await library();
    const flag = analysis.flags[0];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: {
        rewrites: analysis.flags[1].sourceSentence,
        replacement:
          'This clause is struck, and nothing replaces it in this agreement.',
      },
    });

    const result = await firmCounterOffer({ documents, model }, 'doc-1', flag.id);

    expect(result).toEqual({ at: 'refused', reason: FIRM_DRAFT_FAILED });
    const reopened = await documents.byId('doc-1');
    expect(
      reopened?.analysis?.counterOffers.some((each) => each.stance === 'firm'),
    ).toBe(false);
    warn.mockRestore();
  });
});

describe('a firm draft the reader already has', () => {
  async function drafted() {
    const { text, sidecar } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({
      rows: [[documentRow(text)], [], [documentRow(text)]],
    });
    await readDocument(
      {
        documents: createSupabaseDocuments(client, OWNER),
        redLines: createSupabaseRedLines(client, OWNER),
        model: stubModelClientFor(sidecar),
      },
      'doc-1',
    );
    const analysis = queries[2].values?.analysis as AnalysisResult;
    const { documents, rows } = storedLibrary(documentRow(text, json(analysis)));
    const flagId = analysis.flags[0].id;
    const model = createStubModelClient({
      [COUNTER_OFFER_CALL_NAME]: counterOfferFor,
    });
    const first = await firmCounterOffer({ documents, model }, 'doc-1', flagId);
    return { documents, rows, flagId, model, first, text };
  }

  it('is handed back on a second switch without asking the model again', async () => {
    const { documents, model, flagId, first } = await drafted();
    expect(draftingCalls(model.calls)).toHaveLength(1);

    const second = await firmCounterOffer({ documents, model }, 'doc-1', flagId);

    expect(draftingCalls(model.calls)).toHaveLength(1);
    expect(second.at).toBe('drafted');
    if (second.at !== 'drafted' || first.at !== 'drafted') return;
    expect(second.fromStore).toBe(true);
    expect(second.counterOffer.text).toBe(first.counterOffer.text);
  });

  it('comes back with the document when it is reopened later', async () => {
    const { rows, flagId, first, text } = await drafted();

    // A later visit: a new gateway over the same rows, and a model that has
    // nothing to answer a drafting call with. Nothing asks it one.
    const later = storedLibrary(rows.get('doc-1') as DocumentRow);
    const cold = createStubModelClient({});

    const reopened = await later.documents.byId('doc-1');
    const result = await firmCounterOffer(
      { documents: later.documents, model: cold },
      'doc-1',
      flagId,
    );

    expect(cold.calls).toHaveLength(0);
    expect(result.at).toBe('drafted');
    if (result.at !== 'drafted' || first.at !== 'drafted') return;
    expect(result.counterOffer.text).toBe(first.counterOffer.text);
    expect(reopened?.text).toBe(text);
    expect(
      reopened?.analysis?.counterOffers.filter((each) => each.stance === 'firm'),
    ).toHaveLength(1);
  });
});

describe('when the firm draft cannot be made', () => {
  async function library() {
    const { text, sidecar } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({
      rows: [[documentRow(text)], [], [documentRow(text)]],
    });
    await readDocument(
      {
        documents: createSupabaseDocuments(client, OWNER),
        redLines: createSupabaseRedLines(client, OWNER),
        model: stubModelClientFor(sidecar),
      },
      'doc-1',
    );
    const analysis = queries[2].values?.analysis as AnalysisResult;
    return {
      ...storedLibrary(documentRow(text, json(analysis))),
      analysis,
    };
  }

  it('leaves the soft counter-offer intact and says what happened', async () => {
    const { documents, analysis } = await library();
    const flag = analysis.flags[0];
    const soft = analysis.counterOffers.find(
      (each) => each.flagId === flag.id && each.stance === 'soft',
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createStubModelClient({});
    model.fail(COUNTER_OFFER_CALL_NAME, 'The drafting model is down.');

    const result = await firmCounterOffer({ documents, model }, 'doc-1', flag.id);

    expect(result).toEqual({ at: 'refused', reason: FIRM_DRAFT_FAILED });
    const reopened = await documents.byId('doc-1');
    const forFlag = reopened?.analysis?.counterOffers.filter(
      (each) => each.flagId === flag.id,
    );
    expect(forFlag?.map((each) => each.stance)).toEqual(['soft']);
    expect(forFlag?.[0].text).toBe(soft?.text);
    warn.mockRestore();
  });

  it('can be asked again once the model is back', async () => {
    const { documents, analysis } = await library();
    const flag = analysis.flags[0];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createStubModelClient({});
    model.fail(COUNTER_OFFER_CALL_NAME, 'The drafting model is down.');
    await firmCounterOffer({ documents, model }, 'doc-1', flag.id);

    model.reply(COUNTER_OFFER_CALL_NAME, counterOfferFor);
    const result = await firmCounterOffer({ documents, model }, 'doc-1', flag.id);

    expect(result.at).toBe('drafted');
    if (result.at !== 'drafted') return;
    expect(result.counterOffer.stance).toBe('firm');
    expect(draftingCalls(model.calls)).toHaveLength(2);
    warn.mockRestore();
  });

  it('says so when the document is no longer the reader’s', async () => {
    const { documents, analysis } = await library();
    const model = createStubModelClient({});

    const result = await firmCounterOffer(
      { documents, model },
      'doc-missing',
      analysis.flags[0].id,
    );

    expect(result.at).toBe('refused');
    expect(model.calls).toHaveLength(0);
  });

  it('says so when the flag is not in this read', async () => {
    const { documents } = await library();
    const model = createStubModelClient({});

    const result = await firmCounterOffer({ documents, model }, 'doc-1', 'no-flag');

    expect(result.at).toBe('refused');
    expect(model.calls).toHaveLength(0);
  });
});
