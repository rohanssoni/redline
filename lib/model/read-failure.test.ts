import { describe, expect, it } from 'vitest';
import { AnalysisError } from '../analysis/types';
import { ModelCallError, ModelOutputError } from './client';
import { readFailure } from './read-failure';

describe('readFailure', () => {
  it('tells a visitor the model was busy, and when to send it again', () => {
    const failure = readFailure(
      new ModelCallError('OpenRouter refused document_summary: busy', 429),
      { saved: false },
    );

    expect(failure.status).toBe(503);
    expect(failure.retryAfterSeconds).toBe(60);
    expect(failure.message).toBe(
      'The model Redline uses was too busy to take this read. Nothing was saved. Wait a minute, then send it again.',
    );
  });

  it('tells a reader with a saved document the model was busy', () => {
    const failure = readFailure(
      new ModelCallError('OpenRouter refused document_summary: busy', 429),
      { saved: true },
    );

    expect(failure.status).toBe(503);
    expect(failure.message).toBe(
      'The model Redline uses was too busy to take this read. Your document is saved, so wait a minute and start the read again.',
    );
  });

  it('keeps the general message for a model error that is not a rate limit', () => {
    const failure = readFailure(
      new ModelCallError('OpenRouter refused document_summary: Insufficient credits', 402),
      { saved: false },
    );

    expect(failure.status).toBe(502);
    expect(failure.retryAfterSeconds).toBeUndefined();
    expect(failure.message).toBe(
      'The read didn’t finish. Nothing was saved, so you can start it again.',
    );
  });

  it('keeps the general message for a reply that could not be trusted', () => {
    const failure = readFailure(new ModelOutputError('not JSON'), { saved: true });

    expect(failure.status).toBe(502);
    expect(failure.message).toBe(
      'The read didn’t finish. Your document is saved, so you can start it again.',
    );
  });

  it('passes an analysis refusal through as it is', () => {
    const failure = readFailure(
      new AnalysisError('There is not enough text in this document to read.'),
      { saved: false },
    );

    expect(failure.status).toBe(502);
    expect(failure.message).toBe('There is not enough text in this document to read.');
  });
});
