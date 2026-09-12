'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { LibraryEntry } from '@/lib/documents/library';
import { deleteDocument, type LibraryFormState } from './actions';

/**
 * The library, newest first. Each line names a document, says when it was read,
 * and opens it — the read that is already stored, never a new one.
 */
export function LibraryShelf({ entries }: { entries: LibraryEntry[] }) {
  return (
    <ul className="library">
      {entries.map((entry) => (
        <li key={entry.id}>
          <LibraryRow entry={entry} />
        </li>
      ))}
    </ul>
  );
}

function LibraryRow({ entry }: { entry: LibraryEntry }) {
  const [state, formAction, deleting] = useActionState<
    LibraryFormState,
    FormData
  >(deleteDocument, {});
  const [asking, setAsking] = useState(false);

  return (
    <div className="library-row">
      <div className="library-row-body">
        <Link className="library-name" href={`/documents/${entry.id}`}>
          {entry.name}
        </Link>
        <p className="library-when">
          {entry.read ? (
            <>
              Read on <time dateTime={entry.savedAt}>{entry.savedOn}</time>
            </>
          ) : (
            <>
              Saved on <time dateTime={entry.savedAt}>{entry.savedOn}</time>, not
              read yet
            </>
          )}
        </p>
      </div>

      {asking ? (
        <form className="library-confirm" action={formAction}>
          <input type="hidden" name="id" value={entry.id} />
          <p>Delete this for good? The text and the read go with it.</p>
          <div className="state-actions">
            <button className="link-button" type="submit" disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, delete it'}
            </button>
            <button
              className="link-button"
              type="button"
              onClick={() => setAsking(false)}
              disabled={deleting}
            >
              Keep it
            </button>
          </div>
        </form>
      ) : (
        <button
          className="link-button"
          type="button"
          onClick={() => setAsking(true)}
        >
          Delete
        </button>
      )}

      {state.error ? (
        <div className="state" data-tone="refused" role="alert">
          <p className="state-title">{state.error}</p>
        </div>
      ) : null}
    </div>
  );
}
