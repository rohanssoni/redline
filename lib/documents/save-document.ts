import type { DocumentInput } from '../parsing/document-input';

/**
 * Sending a document's text to be stored. Both input paths call this with the
 * same `DocumentInput`, so the request carries a name and text and nothing that
 * would tell the server whether the reader uploaded or pasted (ADR-0020).
 */

/** The saved document's id, or a reason to put in front of the reader. */
export type SaveOutcome =
  | { saved: true; id: string }
  | { saved: false; reason: string };

export async function saveDocument(input: DocumentInput): Promise<SaveOutcome> {
  let response: Response;
  try {
    response = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.name, text: input.text }),
    });
  } catch {
    return {
      saved: false,
      reason:
        'Redline couldn’t be reached. Check your connection and send it again.',
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
      saved: false,
      reason: body.error ?? 'The document couldn’t be saved. Try it again.',
    };
  }
  return { saved: true, id: body.id };
}
