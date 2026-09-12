import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import { DocumentStoreError } from './store';
import { createSupabaseDocuments } from './supabase-documents';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';
const OTHER_OWNER = '11111111-2222-3333-4444-555555555555';

function rowFor(text: string, analysis: unknown = null) {
  return {
    id: 'doc-1',
    name: 'Halverson agreement.pdf',
    extracted_text: text,
    analysis,
    created_at: '2026-09-11T10:00:00Z',
    updated_at: '2026-09-11T10:00:00Z',
  };
}

describe('the documents table, for one reader', () => {
  it('stores the extracted text under the reader who uploaded it', async () => {
    const { text } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({ rows: [[rowFor(text)]] });

    const saved = await createSupabaseDocuments(client, OWNER).create({
      name: 'Halverson agreement.pdf',
      text,
    });

    expect(queries[0].table).toBe('documents');
    expect(queries[0].operation).toBe('insert');
    expect(queries[0].values).toEqual({
      owner_id: OWNER,
      name: 'Halverson agreement.pdf',
      extracted_text: text,
    });
    expect(saved.text).toBe(text);
    expect(saved.analysis).toBeNull();
  });

  it('stores no file, no path, and nothing but the text', async () => {
    const { text } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({ rows: [[rowFor(text)]] });

    await createSupabaseDocuments(client, OWNER).create({ name: 'a.pdf', text });

    expect(Object.keys(queries[0].values ?? {}).sort()).toEqual([
      'extracted_text',
      'name',
      'owner_id',
    ]);
  });

  it('asks for one document by id and by owner, both', async () => {
    const { text } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({ rows: [[rowFor(text)]] });

    await createSupabaseDocuments(client, OWNER).byId('doc-1');

    expect(queries[0].filters).toEqual([
      ['id', 'doc-1'],
      ['owner_id', OWNER],
    ]);
  });

  it('finds nothing when the document belongs to someone else', async () => {
    const { client } = createStubSupabase({ rows: [[]] });

    const found = await createSupabaseDocuments(client, OTHER_OWNER).byId('doc-1');

    expect(found).toBeNull();
  });

  it('lists a reader’s own library, newest first, without the text', async () => {
    const { text } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({
      rows: [[rowFor(text, { summary: 'A summary.', flags: [], gaps: [] })]],
    });

    const listing = await createSupabaseDocuments(client, OWNER).list();

    expect(queries[0].columns).not.toContain('extracted_text');
    expect(queries[0].filters).toEqual([['owner_id', OWNER]]);
    expect(queries[0].order).toEqual(['created_at', { ascending: false }]);
    expect(listing).toEqual([
      {
        id: 'doc-1',
        name: 'Halverson agreement.pdf',
        analysed: true,
        createdAt: '2026-09-11T10:00:00Z',
        updatedAt: '2026-09-11T10:00:00Z',
      },
    ]);
  });

  it('writes back the analysis it was given and reads it out again', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const analysis = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });
    const { client, queries } = createStubSupabase({
      rows: [[rowFor(text, analysis)]],
    });

    const updated = await createSupabaseDocuments(client, OWNER).recordAnalysis(
      'doc-1',
      analysis,
    );

    expect(queries[0].operation).toBe('update');
    expect(queries[0].values?.analysis).toEqual(analysis);
    expect(queries[0].filters).toEqual([
      ['id', 'doc-1'],
      ['owner_id', OWNER],
    ]);
    expect(updated.analysis?.summary).toBe(sidecar.summary);
  });

  it('keeps the ranked flags with the document and reads them back in order', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const analysis = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });
    const { client } = createStubSupabase({ rows: [[rowFor(text, analysis)]] });

    const reopened = await createSupabaseDocuments(client, OWNER).byId('doc-1');

    expect(reopened?.analysis?.flags.map((flag) => flag.id)).toEqual(
      analysis.flags.map((flag) => flag.id),
    );
    for (const flag of reopened?.analysis?.flags ?? []) {
      expect(text).toContain(flag.sourceSentence);
    }
  });

  it('drops a stored flag whose sentence is not in the document it was stored with', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const analysis = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });
    const tampered = {
      ...analysis,
      flags: [
        ...analysis.flags,
        {
          ...analysis.flags[0],
          id: 'not-in-this-document',
          sourceSentence:
            'Contractor shall pay Client a penalty of $50,000 on any late delivery.',
        },
      ],
    };
    const { client } = createStubSupabase({ rows: [[rowFor(text, tampered)]] });

    const reopened = await createSupabaseDocuments(client, OWNER).byId('doc-1');

    expect(reopened?.analysis?.flags.map((flag) => flag.id)).not.toContain(
      'not-in-this-document',
    );
    expect(reopened?.analysis?.flags).toHaveLength(analysis.flags.length);
  });

  it('reads a row whose analysis column holds something else as not analysed', async () => {
    const { text } = loadAdhesionFixture();
    const { client } = createStubSupabase({
      rows: [[rowFor(text, { summary: '', flags: 'none' })]],
    });

    const document = await createSupabaseDocuments(client, OWNER).byId('doc-1');

    expect(document?.analysis).toBeNull();
    expect(document?.text).toBe(text);
  });

  it('says what went wrong when the database refuses', async () => {
    const { client } = createStubSupabase({
      error: 'new row violates row-level security policy for table "documents"',
    });

    await expect(
      createSupabaseDocuments(client, OWNER).create({ name: 'a.pdf', text: 'x' }),
    ).rejects.toBeInstanceOf(DocumentStoreError);
  });
});
