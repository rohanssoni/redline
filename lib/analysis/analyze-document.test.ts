import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture, loadCleanFixture } from '../../tests/fixtures';
import {
  createStubModelClient,
  proposedFlagsFor,
  stubModelClientFor,
} from '../../tests/support/stub-model-client';
import { ModelOutputError } from '../model/client';
import { analyzeDocument } from './analyze-document';
import { bandFor } from './ranking';
import { AnalysisError } from './types';

describe('analyzeDocument, summary stage', () => {
  it('returns the summary the model produced for the document it was given', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    const result = await analyzeDocument(text, sidecar.redLines, { model });

    expect(result.summary).toBe(sidecar.summary);
  });

  it('summarises each document from its own text', async () => {
    const adhesion = loadAdhesionFixture();
    const clean = loadCleanFixture();

    const adhesionResult = await analyzeDocument(adhesion.text, [], {
      model: stubModelClientFor(adhesion.sidecar),
    });
    const cleanResult = await analyzeDocument(clean.text, [], {
      model: stubModelClientFor(clean.sidecar),
    });

    expect(adhesionResult.summary).toBe(adhesion.sidecar.summary);
    expect(cleanResult.summary).toBe(clean.sidecar.summary);
    expect(adhesionResult.summary).not.toBe(cleanResult.summary);
  });

  it('sends the document text to the model as structured output', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    await analyzeDocument(text, sidecar.redLines, { model });

    const request = model.calls[0];
    expect(request.name).toBe('document_summary');
    expect(request.schema.required).toContain('summary');
    expect(request.schema.additionalProperties).toBe(false);

    const sent = request.messages.map((message) => message.content).join('\n');
    for (const flag of sidecar.flags) {
      expect(sent).toContain(flag.sourceSentence);
    }
  });

  it('carries no gaps yet: a missing term has no sentence to quote', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(result.gaps).toEqual([]);
  });

  it('refuses a reply that is not the shape the schema asked for', async () => {
    const { text, sidecar } = loadCleanFixture();
    const model = createStubModelClient({
      document_summary: { summary: 42, severity: 'high' },
      document_flags: { flags: [] },
    });

    await expect(
      analyzeDocument(text, sidecar.redLines, { model }),
    ).rejects.toBeInstanceOf(ModelOutputError);
  });

  it('refuses a document with nothing in it to read, without calling the model', async () => {
    const model = createStubModelClient({
      document_summary: { summary: 'x' },
      document_flags: { flags: [] },
    });

    await expect(analyzeDocument('   \n\n  \f ', [], { model })).rejects.toBeInstanceOf(
      AnalysisError,
    );
    expect(model.calls).toHaveLength(0);
  });

  it('lets a failed model call surface rather than returning a clean read', async () => {
    const { text, sidecar } = loadCleanFixture();
    const model = stubModelClientFor(sidecar);
    model.fail('document_summary', 'OpenRouter is unreachable');

    await expect(analyzeDocument(text, [], { model })).rejects.toThrow(
      /unreachable/,
    );
  });
});

describe('analyzeDocument, flag stage', () => {
  it('drops a fabricated quote and a tidied-up one, and keeps the copied one', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const real = sidecar.flags[0];
    const tidied = sidecar.flags[1];
    const fabricated =
      'Contractor waives every right to payment for work Client later decides it does not want.';
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [
        proposal(real.sourceSentence, { id: 'copied-word-for-word' }),
        proposal(fabricated, { id: 'invented-sentence' }),
        proposal(
          `${tidied.sourceSentence.replace(', in its sole discretion,', ' in its sole discretion').slice(0, -1)}!`,
          { id: 'tidied-up-sentence' },
        ),
      ],
    });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags.map((flag) => flag.id)).toEqual(['copied-word-for-word']);
    expect(result.flags[0].sourceSentence).toBe(real.sourceSentence);
    for (const flag of result.flags) {
      expect(text).toContain(flag.sourceSentence);
    }
  });

  it('shows the document’s own wording when the quote came back rewrapped', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const planted = sidecar.flags[2];
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [proposal(planted.sourceSentence.split(' ').join('\n'), { id: 'rewrapped' })],
    });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags[0].sourceSentence).toBe(planted.sourceSentence);
  });

  it('leaves out the unusual but even-handed clause rather than ranking it low', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const symmetric = sidecar.decoys.symmetricUnusual;
    expect(symmetric).toBeDefined();

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    expect(text).toContain(symmetric?.sourceSentence);
    expect(
      result.flags.some(
        (flag) => flag.sourceSentence === symmetric?.sourceSentence,
      ),
    ).toBe(false);
  });

  it('still flags a citable clause the reading is only partly confident about', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const partial = sidecar.flags.filter(
      (flag) => flag.harmConfidence === 'partial' && flag.plausible !== false,
    );
    expect(partial.length).toBeGreaterThan(0);

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    for (const flag of partial) {
      const shown = result.flags.find((each) => each.id === flag.id);
      expect(shown?.sourceSentence).toBe(flag.sourceSentence);
      expect(shown?.harmConfidence).toBe('partial');
    }
  });

  it('leaves out the clause that only a red line would catch, when none is set', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const redLineOnly = sidecar.flags.filter((flag) => flag.plausible === false);
    expect(redLineOnly.length).toBeGreaterThan(0);

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    expect(result.flags.map((flag) => flag.id)).toEqual(
      sidecar.flags
        .filter((flag) => flag.plausible !== false)
        .map((flag) => flag.id),
    );
  });

  it('ranks the flags by what they cost the reader, worst first', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    const severities = result.flags.map((flag) => flag.severity);
    expect(severities).toEqual([...severities].sort((a, b) => b - a));
    expect(result.flags[0].id).toBe('uncapped-indemnity');
    expect(result.flags.map((flag) => flag.band)).toEqual(
      result.flags.map((flag) => bandFor(flag.severity)),
    );
  });

  it('gives every flag a sentence, an explanation and a severity', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(result.flags.length).toBeGreaterThan(0);
    for (const flag of result.flags) {
      expect(flag.sourceSentence.trim().length).toBeGreaterThan(0);
      expect(flag.explanation.trim().length).toBeGreaterThan(0);
      expect(flag.severity).toBeGreaterThanOrEqual(0);
      expect(flag.severity).toBeLessThanOrEqual(100);
      expect(['high', 'medium', 'low']).toContain(flag.band);
    }
  });

  it('sends the document to the flag stage as structured output of its own', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    await analyzeDocument(text, sidecar.redLines, { model });

    expect(model.calls.map((call) => call.name)).toEqual([
      'document_summary',
      'document_flags',
    ]);
    const request = model.calls[1];
    expect(request.schema.required).toContain('flags');
    expect(request.schema.additionalProperties).toBe(false);
    expect(request.messages.map((message) => message.content).join('\n')).toContain(
      sidecar.flags[0].sourceSentence,
    );
  });

  it('finds nothing to flag in an agreement with nothing one-sided in it', async () => {
    const { text, sidecar } = loadCleanFixture();

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    expect(result.flags).toEqual([]);
    expect(result.summary).toBe(sidecar.summary);
  });

  it('lets a failed flag call surface rather than returning a document with no flags', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    model.fail('document_flags', 'OpenRouter is unreachable');

    await expect(analyzeDocument(text, [], { model })).rejects.toThrow(/unreachable/);
  });
});

/** One flag as a model would propose it: dangerous, citable, plainly worded. */
function proposal(
  sourceSentence: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const { sidecar } = loadAdhesionFixture();
  const [shape] = proposedFlagsFor(sidecar) as Record<string, unknown>[];
  return { ...shape, sourceSentence, ...overrides };
}
