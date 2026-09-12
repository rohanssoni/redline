import type { AnonymousRead } from './try-document';

/**
 * Sending the try this tab is holding to be kept, once the visitor has an
 * account.
 *
 * The text and the read both go up as they are. The tab is the only place
 * either of them exists, so what it sends is what gets stored — there is
 * nothing on the server to reconcile them against, and no second read to fall
 * back on.
 */

/** The kept document's id, or a reason to put in front of the reader. */
export type KeepOutcome =
  | { kept: true; id: string }
  | { kept: false; reason: string };

export interface TryToKeep {
  name: string;
  /** The analysed text, exactly as `/api/try` sent it back. */
  text: string;
  read: AnonymousRead;
}

export async function keepThisTry(tried: TryToKeep): Promise<KeepOutcome> {
  let response: Response;
  try {
    response = await fetch('/api/try/keep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tried.name,
        text: tried.text,
        analysis: tried.read,
      }),
    });
  } catch {
    return {
      kept: false,
      reason:
        'Redline couldn’t be reached. Your account is set up, so try this again while the tab is still open.',
    };
  }

  let body: { id?: string; error?: string };
  try {
    body = (await response.json()) as { id?: string; error?: string };
  } catch {
    body = {};
  }

  if (!response.ok || !body.id) {
    return {
      kept: false,
      reason: body.error ?? 'The document couldn’t be saved. Try it again.',
    };
  }
  return { kept: true, id: body.id };
}
