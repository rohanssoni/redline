import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture, loadCleanFixture } from '../../tests/fixtures';
import {
  createStubModelClient,
  stubModelClientFor,
} from '../../tests/support/stub-model-client';
import { ModelOutputError } from '../model/client';
import { analyzeDocument } from './analyze-document';
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

    expect(model.calls).toHaveLength(1);
    const [request] = model.calls;
    expect(request.name).toBe('document_summary');
    expect(request.schema.required).toContain('summary');
    expect(request.schema.additionalProperties).toBe(false);

    const sent = request.messages.map((message) => message.content).join('\n');
    for (const flag of sidecar.flags) {
      expect(sent).toContain(flag.sourceSentence);
    }
  });

  it('carries no flags and no gaps yet, and never a summary with either in it', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(result.flags).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it('refuses a reply that is not the shape the schema asked for', async () => {
    const { text, sidecar } = loadCleanFixture();
    const model = createStubModelClient({
      document_summary: { summary: 42, severity: 'high' },
    });

    await expect(
      analyzeDocument(text, sidecar.redLines, { model }),
    ).rejects.toBeInstanceOf(ModelOutputError);
  });

  it('refuses a document with nothing in it to read, without calling the model', async () => {
    const model = createStubModelClient({ document_summary: { summary: 'x' } });

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
