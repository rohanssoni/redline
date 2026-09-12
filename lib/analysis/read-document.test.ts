import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture, loadCleanFixture } from '../../tests/fixtures';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { createSupabaseDocuments } from '../documents/supabase-documents';
import { createSupabaseRedLines } from '../red-lines/supabase-red-lines';
import type { AnalysisResult } from './types';
import { readDocument } from './read-document';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';

function documentRow(id: string, name: string, text: string, analysis: unknown = null) {
  return {
    id,
    name,
    extracted_text: text,
    analysis,
    created_at: '2026-09-11T10:00:00Z',
    updated_at: '2026-09-11T10:00:00Z',
  };
}

function redLineRow(id: string, text: string) {
  return {
    id,
    text,
    created_at: '2026-09-11T10:00:00Z',
    updated_at: '2026-09-11T10:00:00Z',
  };
}

/** Records what the read was given, and answers with a result of its own. */
function watchedAnalysis() {
  const given: string[][] = [];
  const analyze = async (
    _text: string,
    redLines: string[],
  ): Promise<AnalysisResult> => {
    given.push(redLines);
    return { summary: 'A summary of this agreement.', flags: [], gaps: [], cleanRead: null };
  };
  return { given, analyze };
}

describe('reading one of the reader’s documents', () => {
  it('hands the read the reader’s own red lines', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({
      rows: [
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
        sidecar.redLines.map((redLine, index) =>
          redLineRow(`red-line-${index}`, redLine),
        ),
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
      ],
    });
    const watched = watchedAnalysis();

    await readDocument(
      {
        documents: createSupabaseDocuments(client, OWNER),
        redLines: createSupabaseRedLines(client, OWNER),
        model: stubModelClientFor(sidecar),
        analyze: watched.analyze,
      },
      'doc-1',
    );

    expect(watched.given).toEqual([sidecar.redLines]);
    expect(queries[1].table).toBe('red_lines');
    expect(queries[1].filters).toEqual([['owner_id', OWNER]]);
  });

  it('reads the list again on the next run rather than a stale copy', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const rewritten = 'I will not sign away the right to show my own work.';
    const { client } = createStubSupabase({
      rows: [
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
        [redLineRow('red-line-0', sidecar.redLines[0])],
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
        [redLineRow('red-line-0', rewritten), redLineRow('red-line-1', 'I need a deadline.')],
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
      ],
    });
    const watched = watchedAnalysis();
    const deps = {
      documents: createSupabaseDocuments(client, OWNER),
      redLines: createSupabaseRedLines(client, OWNER),
      model: stubModelClientFor(sidecar),
      analyze: watched.analyze,
    };

    await readDocument(deps, 'doc-1');
    await readDocument(deps, 'doc-1');

    expect(watched.given).toEqual([
      [sidecar.redLines[0]],
      [rewritten, 'I need a deadline.'],
    ]);
  });

  it('carries the same list into a second, different document', async () => {
    const adhesion = loadAdhesionFixture();
    const clean = loadCleanFixture();
    const { client } = createStubSupabase({
      rows: [
        [documentRow('doc-1', 'Halverson agreement.pdf', adhesion.text)],
        adhesion.sidecar.redLines.map((redLine, index) =>
          redLineRow(`red-line-${index}`, redLine),
        ),
        [documentRow('doc-1', 'Halverson agreement.pdf', adhesion.text)],
        [documentRow('doc-2', 'Second agreement.pdf', clean.text)],
        adhesion.sidecar.redLines.map((redLine, index) =>
          redLineRow(`red-line-${index}`, redLine),
        ),
        [documentRow('doc-2', 'Second agreement.pdf', clean.text)],
      ],
    });
    const watched = watchedAnalysis();
    const deps = {
      documents: createSupabaseDocuments(client, OWNER),
      redLines: createSupabaseRedLines(client, OWNER),
      model: stubModelClientFor(adhesion.sidecar),
      analyze: watched.analyze,
    };

    await readDocument(deps, 'doc-1');
    await readDocument(deps, 'doc-2');

    expect(watched.given).toEqual([
      adhesion.sidecar.redLines,
      adhesion.sidecar.redLines,
    ]);
  });

  it('reads a document with an empty list when the reader has written none', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const { client } = createStubSupabase({
      rows: [
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
        [],
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
      ],
    });
    const watched = watchedAnalysis();

    await readDocument(
      {
        documents: createSupabaseDocuments(client, OWNER),
        redLines: createSupabaseRedLines(client, OWNER),
        model: stubModelClientFor(sidecar),
        analyze: watched.analyze,
      },
      'doc-1',
    );

    expect(watched.given).toEqual([[]]);
  });

  it('runs the real read and keeps its result with the document', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const { client, queries } = createStubSupabase({
      rows: [
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
        [redLineRow('red-line-0', sidecar.redLines[0])],
        [documentRow('doc-1', 'Halverson agreement.pdf', text)],
      ],
    });

    const saved = await readDocument(
      {
        documents: createSupabaseDocuments(client, OWNER),
        redLines: createSupabaseRedLines(client, OWNER),
        model: stubModelClientFor(sidecar),
      },
      'doc-1',
    );

    expect(queries.map((query) => query.table)).toEqual([
      'documents',
      'red_lines',
      'documents',
    ]);
    expect(queries[2].operation).toBe('update');
    const written = queries[2].values?.analysis as { summary: string };
    expect(written.summary).toBe(sidecar.summary);
    expect(saved?.name).toBe('Halverson agreement.pdf');
  });

  it('reads nothing, and asks for no red lines, when the document is not the reader’s', async () => {
    const { client, queries } = createStubSupabase({ rows: [[]] });

    const saved = await readDocument(
      {
        documents: createSupabaseDocuments(client, OWNER),
        redLines: createSupabaseRedLines(client, OWNER),
        model: stubModelClientFor(loadAdhesionFixture().sidecar),
      },
      'doc-1',
    );

    expect(saved).toBeNull();
    expect(queries.map((query) => query.table)).toEqual(['documents']);
  });
});
