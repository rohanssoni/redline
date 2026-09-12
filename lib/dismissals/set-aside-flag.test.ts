import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { createStubSupabase } from '../../tests/support/stub-supabase';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import type { AnalysisResult } from '../analysis/types';
import { createSupabaseDocuments } from '../documents/supabase-documents';
import { bringFlagBack, flagsSetAside, setFlagAside } from './set-aside-flag';
import { createSupabaseFlagDismissals } from './supabase-flag-dismissals';

const OWNER = '7d2a4c2e-0b7e-4e3d-8a1b-2f2b1c9f0a11';
const DOCUMENT = '5f4d3c2b-1a09-4e8f-9d7c-6b5a4f3e2d10';

async function read(): Promise<{ analysis: AnalysisResult; text: string }> {
  const { text, sidecar } = loadAdhesionFixture();
  const analysis = await analyzeDocument(text, sidecar.redLines, {
    model: stubModelClientFor(sidecar),
  });
  return { analysis, text };
}

function documentRow(text: string, analysis: AnalysisResult | null) {
  return {
    id: DOCUMENT,
    name: 'Freelance agreement.pdf',
    extracted_text: text,
    analysis: analysis ? JSON.parse(JSON.stringify(analysis)) : null,
    created_at: '2026-09-12T09:00:00Z',
    updated_at: '2026-09-12T09:00:00Z',
  };
}

function depsFor(rows: unknown[][]) {
  const { client, queries } = createStubSupabase({ rows });
  return {
    queries,
    deps: {
      documents: createSupabaseDocuments(client, OWNER),
      dismissals: createSupabaseFlagDismissals(client, OWNER),
    },
  };
}

describe('setting a flag aside', () => {
  it('records an ordinary flag as ordinary, from the read rather than the page', async () => {
    const { analysis, text } = await read();
    const ordinary = analysis.flags.find(
      (flag) => !analysis.redLineMatches.some((match) => match.flagId === flag.id),
    );
    expect(ordinary).toBeDefined();

    const { deps, queries } = depsFor([
      [documentRow(text, analysis)],
      [{ id: 'dismissal-1' }],
    ]);

    const result = await setFlagAside(deps, DOCUMENT, ordinary!.id);

    expect(result).toEqual({
      at: 'set-aside',
      flag: {
        documentId: DOCUMENT,
        flagId: ordinary!.id,
        redLineTriggered: false,
      },
    });
    expect(queries[1].operation).toBe('insert');
    expect(queries[1].values?.red_line_triggered).toBe(false);
  });

  it('records a red-line-triggered flag as one, though nothing on screen said so', async () => {
    const { analysis, text } = await read();
    const match = analysis.redLineMatches[0];
    expect(match).toBeDefined();

    const { deps, queries } = depsFor([
      [documentRow(text, analysis)],
      [{ id: 'dismissal-1' }],
    ]);

    const result = await setFlagAside(deps, DOCUMENT, match.flagId);

    expect(result).toEqual({
      at: 'set-aside',
      flag: {
        documentId: DOCUMENT,
        flagId: match.flagId,
        redLineTriggered: true,
      },
    });
    expect(queries[1].values?.red_line_triggered).toBe(true);
  });

  it('will not set a gap aside, and writes nothing when asked to', async () => {
    const { analysis, text } = await read();
    expect(analysis.gaps.length).toBeGreaterThan(0);

    const { deps, queries } = depsFor([[documentRow(text, analysis)]]);

    const result = await setFlagAside(deps, DOCUMENT, analysis.gaps[0].id);

    expect(result.at).toBe('refused');
    expect(queries.some((query) => query.operation === 'insert')).toBe(false);
  });

  it('refuses a flag that is not in this read, and writes nothing', async () => {
    const { analysis, text } = await read();
    const { deps, queries } = depsFor([[documentRow(text, analysis)]]);

    const result = await setFlagAside(deps, DOCUMENT, 'a-flag-from-somewhere-else');

    expect(result.at).toBe('refused');
    expect(queries.some((query) => query.operation === 'insert')).toBe(false);
  });

  it('refuses a document this reader does not have', async () => {
    const { deps, queries } = depsFor([[]]);

    const result = await setFlagAside(deps, DOCUMENT, 'uncapped-indemnity');

    expect(result.at).toBe('refused');
    expect(queries.length).toBe(1);
  });

  it('refuses a document nobody has read yet', async () => {
    const { text } = await read();
    const { deps, queries } = depsFor([[documentRow(text, null)]]);

    const result = await setFlagAside(deps, DOCUMENT, 'uncapped-indemnity');

    expect(result.at).toBe('refused');
    expect(queries.some((query) => query.operation === 'insert')).toBe(false);
  });
});

describe('bringing a flag back', () => {
  it('deletes the dismissal for that one flag of that one document', async () => {
    const { analysis, text } = await read();
    const flagId = analysis.flags[0].id;
    const { deps, queries } = depsFor([
      [documentRow(text, analysis)],
      [{ id: 'dismissal-1' }],
    ]);

    const result = await bringFlagBack(deps, DOCUMENT, flagId);

    expect(result).toEqual({ at: 'brought-back', flagId });
    expect(queries[1].operation).toBe('delete');
    expect(queries[1].filters).toEqual([
      ['document_id', DOCUMENT],
      ['flag_id', flagId],
      ['owner_id', OWNER],
    ]);
  });

  it('will not touch a row for something that is not a flag of this read', async () => {
    const { analysis, text } = await read();
    const { deps, queries } = depsFor([[documentRow(text, analysis)]]);

    const result = await bringFlagBack(deps, DOCUMENT, analysis.gaps[0].id);

    expect(result.at).toBe('refused');
    expect(queries.some((query) => query.operation === 'delete')).toBe(false);
  });
});

describe('what the reader set aside, on the next visit', () => {
  it('comes back from the store, so a dismissal outlives the session', async () => {
    const { deps } = depsFor([
      [
        {
          id: 'dismissal-1',
          document_id: DOCUMENT,
          flag_id: 'overbroad-non-compete',
          red_line_triggered: true,
          created_at: '2026-09-12T10:00:00Z',
        },
        {
          id: 'dismissal-2',
          document_id: DOCUMENT,
          flag_id: 'uncapped-indemnity',
          red_line_triggered: false,
          created_at: '2026-09-12T10:01:00Z',
        },
      ],
    ]);

    const setAside = await flagsSetAside(deps, DOCUMENT);

    expect(setAside).toEqual(['overbroad-non-compete', 'uncapped-indemnity']);
  });
});
