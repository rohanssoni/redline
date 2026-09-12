import Link from 'next/link';
import type { Metadata } from 'next';
import { listLibrary, type LibraryEntry } from '@/lib/documents/library';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import { currentReader } from '@/lib/supabase/server';
import { LibraryShelf } from './library-shelf';

export const metadata: Metadata = { title: 'Library — Redline' };

type Shelf = { entries: LibraryEntry[] } | { problem: string };

/**
 * The reader's own documents, read once and kept.
 *
 * Nothing on this path can reach the model: what a row holds was worked out
 * when the document was read, and opening it again shows that. The gateway is
 * the only thing handed in (`LibraryDeps`).
 */
async function loadLibrary(): Promise<Shelf> {
  const reader = await currentReader();
  if (!reader) return { entries: [] };

  try {
    const entries = await listLibrary({
      documents: createSupabaseDocuments(reader.supabase, reader.user.id),
    });
    return { entries };
  } catch (error) {
    console.error('A reader’s library could not be read', error);
    return {
      problem: 'Your library didn’t load. Reload the page and it should be back.',
    };
  }
}

export default async function LibraryPage() {
  const shelf = await loadLibrary();

  return (
    <section className="sheet">
      <p className="sheet-label">
        <span>Library</span>
        <span>Yours alone</span>
      </p>
      <h1>Your documents</h1>

      <div className="sheet-body">
        <p>
          Everything Redline has read for you. Open one and you get the read it
          already did, with no wait and nothing to upload again.
        </p>
        <p className="note">
          What’s kept here is the text your browser pulled out of the file and
          what Redline found in it. The file itself never left your computer, and
          deleting a document takes the text and the read with it.
        </p>
      </div>

      {'problem' in shelf ? (
        <div className="state" data-tone="refused" role="alert">
          <p className="state-title">{shelf.problem}</p>
        </div>
      ) : shelf.entries.length === 0 ? (
        <NothingSavedYet />
      ) : (
        <LibraryShelf entries={shelf.entries} />
      )}
    </section>
  );
}

/**
 * The empty library. A reader who has read nothing yet has done nothing wrong,
 * so this says what the shelf is for and points at the one thing to do next.
 */
function NothingSavedYet() {
  return (
    <div className="state library-empty" role="status">
      <p className="state-title">Nothing here yet</p>
      <p>
        Documents you upload stay here until you delete them, with the read
        Redline did on them. Start with one someone has asked you to sign.
      </p>
      <div className="state-actions">
        <Link className="link-button" href="/documents/new">
          Read a document
        </Link>
      </div>
    </div>
  );
}
