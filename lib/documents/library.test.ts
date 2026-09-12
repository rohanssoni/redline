import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import {
  createStubModelClient,
  stubModelClientFor,
} from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import { DATE_UNKNOWN, forgetDocument, libraryEntries, listLibrary, openFromLibrary } from './library';
import type { DocumentListing } from './store';
import { createSupabaseDocuments } from './supabase-documents';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';
const OTHER_OWNER = '11111111-2222-3333-4444-555555555555';

const ROOT = process.cwd();

function rowFor(
  id: string,
  name: string,
  createdAt: string,
  analysis: unknown = null,
  text = '',
) {
  return {
    id,
    name,
    extracted_text: text,
    analysis,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function listing(
  id: string,
  name: string,
  createdAt: string,
  analysed = true,
): DocumentListing {
  return { id, name, createdAt, updatedAt: createdAt, analysed };
}

/** An analysis of the fixture, as a read of it would have left in the column. */
async function storedAnalysisFor() {
  const { text, sidecar } = loadAdhesionFixture();
  const model = stubModelClientFor(sidecar);
  const analysis = await analyzeDocument(text, sidecar.redLines, { model });
  return { text, sidecar, analysis, model };
}

describe('the library a reader browses', () => {
  it('lists the reader’s own documents, newest first, with a name and a date', async () => {
    const { client, queries } = createStubSupabase({
      rows: [
        [
          rowFor('doc-1', 'Halverson agreement.pdf', '2026-09-11T10:00:00Z', {
            summary: 'A summary.',
            flags: [],
            gaps: [],
          }),
          rowFor('doc-2', 'Studio lease.docx', '2026-08-02T09:00:00Z'),
        ],
      ],
    });

    const entries = await listLibrary({
      documents: createSupabaseDocuments(client, OWNER),
    });

    expect(queries[0].table).toBe('documents');
    expect(queries[0].filters).toEqual([['owner_id', OWNER]]);
    expect(entries.map((entry) => entry.id)).toEqual(['doc-1', 'doc-2']);
    expect(entries[0].name).toBe('Halverson agreement.pdf');
    expect(entries[0].savedOn).toBe('11 September 2026');
    expect(entries[0].read).toBe(true);
    expect(entries[1].savedOn).toBe('2 August 2026');
    expect(entries[1].read).toBe(false);
  });

  it('puts the newest at the top whatever order the rows arrive in', () => {
    const entries = libraryEntries([
      listing('older', 'Studio lease.docx', '2026-08-02T09:00:00Z'),
      listing('newest', 'Halverson agreement.pdf', '2026-09-11T10:00:00Z'),
      listing('middle', 'Rider.pdf', '2026-09-01T10:00:00Z'),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual([
      'newest',
      'middle',
      'older',
    ]);
  });

  it('still opens a row whose date cannot be read, and says so on the line', () => {
    const entries = libraryEntries([
      listing('undated', 'Scanned terms.pdf', 'whenever'),
      listing('dated', 'Halverson agreement.pdf', '2026-09-11T10:00:00Z'),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(['dated', 'undated']);
    expect(entries[1].savedOn).toBe(DATE_UNKNOWN);
  });

  it('lists none of another reader’s documents', async () => {
    const { client, queries } = createStubSupabase({ rows: [[]] });

    const entries = await listLibrary({
      documents: createSupabaseDocuments(client, OTHER_OWNER),
    });

    expect(entries).toEqual([]);
    expect(queries[0].filters).toEqual([['owner_id', OTHER_OWNER]]);
  });
});

describe('reopening a document from the library', () => {
  it('shows the stored analysis and calls no model at all', async () => {
    const { text, sidecar, analysis, model } = await storedAnalysisFor();
    const callsDuringTheRead = model.calls.length;
    expect(callsDuringTheRead).toBeGreaterThan(0);

    // A model client that is reachable, wired, and answers nothing. Opening a
    // document must not need it: what the reader is shown was worked out when
    // the document was read.
    const idle = createStubModelClient();
    const { client } = createStubSupabase({
      rows: [[rowFor('doc-1', 'Halverson agreement.pdf', '2026-09-11T10:00:00Z', analysis, text)]],
    });

    const reopened = await openFromLibrary(
      { documents: createSupabaseDocuments(client, OWNER) },
      'doc-1',
    );

    expect(idle.calls).toHaveLength(0);
    expect(model.calls).toHaveLength(callsDuringTheRead);
    expect(reopened?.analysis?.summary).toBe(sidecar.summary);
    expect(reopened?.analysis?.flags.map((flag) => flag.id)).toEqual(
      analysis.flags.map((flag) => flag.id),
    );
    for (const flag of reopened?.analysis?.flags ?? []) {
      expect(text).toContain(flag.sourceSentence);
    }
  });

  it('asks the database for one document by id and by owner, and nothing else', async () => {
    const { client, queries } = createStubSupabase({ rows: [[]] });

    const found = await openFromLibrary(
      { documents: createSupabaseDocuments(client, OTHER_OWNER) },
      'doc-1',
    );

    expect(found).toBeNull();
    expect(queries).toHaveLength(1);
    expect(queries[0].filters).toEqual([
      ['id', 'doc-1'],
      ['owner_id', OTHER_OWNER],
    ]);
  });

  it('shows a row stored before counter-offers and red line matches existed', async () => {
    const { text, analysis } = await storedAnalysisFor();
    const older = {
      summary: analysis.summary,
      flags: analysis.flags,
      gaps: analysis.gaps,
    };
    const { client } = createStubSupabase({
      rows: [[rowFor('doc-1', 'Halverson agreement.pdf', '2026-09-11T10:00:00Z', older, text)]],
    });

    const reopened = await openFromLibrary(
      { documents: createSupabaseDocuments(client, OWNER) },
      'doc-1',
    );

    expect(reopened?.analysis?.summary).toBe(analysis.summary);
    expect(reopened?.analysis?.flags.length).toBeGreaterThan(0);
    expect(reopened?.analysis?.counterOffers).toEqual([]);
    expect(reopened?.analysis?.redLineMatches).toEqual([]);
  });
});

describe('deleting a document from the library', () => {
  it('deletes the row by id and by owner, both', async () => {
    const { client, queries } = createStubSupabase({ rows: [[{ id: 'doc-1' }]] });

    const deleted = await forgetDocument(
      { documents: createSupabaseDocuments(client, OWNER) },
      'doc-1',
    );

    expect(deleted).toBe(true);
    expect(queries[0].operation).toBe('delete');
    expect(queries[0].filters).toEqual([
      ['id', 'doc-1'],
      ['owner_id', OWNER],
    ]);
  });

  it('deletes the row itself rather than marking it hidden', async () => {
    const { client, queries } = createStubSupabase({ rows: [[{ id: 'doc-1' }]] });

    await forgetDocument(
      { documents: createSupabaseDocuments(client, OWNER) },
      'doc-1',
    );

    // An update would be a visibility flag: the text and the analysis would
    // still be in the table afterwards.
    expect(queries.map((query) => query.operation)).toEqual(['delete']);
    expect(queries[0].values).toBeUndefined();
  });

  it('says nothing was deleted when the document is someone else’s', async () => {
    const { client, queries } = createStubSupabase({ rows: [[]] });

    const deleted = await forgetDocument(
      { documents: createSupabaseDocuments(client, OTHER_OWNER) },
      'doc-1',
    );

    expect(deleted).toBe(false);
    expect(queries[0].filters).toContainEqual(['owner_id', OTHER_OWNER]);
    expect(queries[0].filters).not.toContainEqual(['owner_id', OWNER]);
  });
});

describe('what the library keeps of a document', () => {
  const COLUMNS = [
    'analysis',
    'created_at',
    'extracted_text',
    'id',
    'name',
    'owner_id',
    'updated_at',
  ];

  it('reads back the extracted text and the analysis, and no other column', async () => {
    const { client, queries } = createStubSupabase({ rows: [[]] });

    await openFromLibrary(
      { documents: createSupabaseDocuments(client, OWNER) },
      'doc-1',
    );

    const asked = (queries[0].columns ?? '').split(',').map((name) => name.trim());
    expect(asked.sort()).toEqual(
      COLUMNS.filter((column) => column !== 'owner_id'),
    );
  });

  it('has no column for a file anywhere in the table', () => {
    const sql = readFileSync(
      join(ROOT, 'supabase', 'migrations', '0001_documents.sql'),
      'utf8',
    );
    const table = sql.match(
      /create table if not exists public\.documents \(([\s\S]*?)\n\);/,
    );
    expect(table, 'no documents table in the migration').not.toBeNull();

    const columns = (table?.[1] ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('--'))
      .map((line) => line.split(/\s+/)[0]);

    expect(columns.sort()).toEqual(COLUMNS);
  });

  it('creates no bucket and stores no bytes in any migration', () => {
    const directory = join(ROOT, 'supabase', 'migrations');
    for (const file of readdirSync(directory)) {
      const sql = readFileSync(join(directory, file), 'utf8').toLowerCase();
      for (const forbidden of [
        'storage.',
        'create bucket',
        'storage.buckets',
        'bytea',
        'base64',
        'file_path',
        'file_url',
        'original_file',
      ]) {
        expect(sql, `${file} reaches for ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('keeps the library screen out of reach of the model, by its imports', () => {
    // The walk reaches the store and the gateway under the screen, so a model
    // client pulled in anywhere beneath it would be seen.
    const beneathTheScreen = importsReachedFrom(
      join('app', '(app)', 'documents', 'page.tsx'),
    );
    expect(beneathTheScreen).toContain(join(ROOT, 'lib', 'documents', 'store.ts'));
    expect(beneathTheScreen).toContain(
      join(ROOT, 'lib', 'analysis', 'verified-flag.ts'),
    );

    for (const seed of [
      join('lib', 'documents', 'library.ts'),
      join('app', '(app)', 'documents', 'page.tsx'),
      join('app', '(app)', 'documents', 'library-shelf.tsx'),
      join('app', '(app)', 'documents', 'actions.ts'),
    ]) {
      for (const reached of importsReachedFrom(seed)) {
        expect(
          reached,
          `${seed} reaches ${reached}`,
        ).not.toMatch(/[\\/]lib[\\/]model[\\/]/);
      }
    }
  });
});

describe('the migration that makes those queries safe', () => {
  const sql = readFileSync(
    join(ROOT, 'supabase', 'migrations', '0001_documents.sql'),
    'utf8',
  );

  it('turns row level security on for the table', () => {
    expect(sql).toMatch(/alter table public\.documents enable row level security/);
  });

  it('gives a reader their own rows and nobody else’s, on every operation', () => {
    for (const operation of ['select', 'insert', 'update', 'delete']) {
      const policy = new RegExp(
        `create policy documents_${operation}_own[\\s\\S]*?;`,
        'i',
      );
      const found = sql.match(policy);
      expect(found, `no ${operation} policy`).not.toBeNull();
      expect(found?.[0]).toContain('to authenticated');
      expect(found?.[0]).toMatch(/owner_id = \(select auth\.uid\(\)\)/);
    }
  });

  it('writes no policy for an unauthenticated visitor', () => {
    expect(sql).not.toMatch(/to anon/);
  });

  it('takes a reader’s documents with the account they belong to', () => {
    expect(sql).toMatch(
      /owner_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
  });
});

/**
 * Every file of this repo's own source that the seed file reaches, directly or
 * through another of its imports. Packages are left alone: what is being
 * checked is which of Redline's own modules a screen can run.
 */
function importsReachedFrom(seed: string): string[] {
  const seen = new Set<string>();
  const queue = [resolve(ROOT, seed)];

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, 'utf8');
    // Type-only imports are erased before anything runs, so they are not a way
    // to reach anything. What is being traced here is what the screen can call.
    const specifiers = [
      ...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+([^;]*?)from\s+'([^']+)'/g),
    ]
      .filter((match) => !/^type\b/.test(match[1].trim()))
      .map((match) => match[2]);
    for (const specifier of specifiers) {
      const target = resolveImport(file, specifier);
      if (target) queue.push(target);
    }
  }

  seen.delete(resolve(ROOT, seed));
  return [...seen];
}

/** Where an import specifier lands in this repo, or null if it leaves it. */
function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? resolve(ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return null;

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
