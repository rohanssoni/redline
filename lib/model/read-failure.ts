import { AnalysisError } from '../analysis/types';
import { ModelCallError } from './client';

export interface ReadFailure {
  status: number;
  message: string;
  /** Set only when waiting is what will help. */
  retryAfterSeconds?: number;
}

/** How long a reader is asked to wait when the model was too busy. */
const BUSY_WAIT_SECONDS = 60;

/**
 * What a reader is told when a read throws. A model that was still turning
 * calls away after the retries in the OpenRouter client is the one failure
 * where waiting helps, so it is the one that says so; everything else keeps
 * the general message.
 */
export function readFailure(error: unknown, { saved }: { saved: boolean }): ReadFailure {
  if (error instanceof AnalysisError) {
    return { status: 502, message: error.message };
  }

  if (error instanceof ModelCallError && error.status === 429) {
    return {
      status: 503,
      retryAfterSeconds: BUSY_WAIT_SECONDS,
      message: saved
        ? 'The model Redline uses was too busy to take this read. Your document is saved, so wait a minute and start the read again.'
        : 'The model Redline uses was too busy to take this read. Nothing was saved. Wait a minute, then send it again.',
    };
  }

  return {
    status: 502,
    message: saved
      ? 'The read didn’t finish. Your document is saved, so you can start it again.'
      : 'The read didn’t finish. Nothing was saved, so you can start it again.',
  };
}

/** What the reader is told when the answering itself didn't finish. */
export const ASK_FAILED =
  'That question didn’t get through. Nothing about your document has changed, so try it again.';

/**
 * What a reader is told when a question to the document throws. As with a
 * read, a model still turning calls away after the client's retries is the one
 * failure where waiting helps, so it is the one that says so.
 */
export function questionFailure(error: unknown): string {
  if (error instanceof ModelCallError && error.status === 429) {
    return 'The model Redline uses was too busy to answer that. Nothing about your document has changed, so wait a minute and ask again.';
  }
  return ASK_FAILED;
}
