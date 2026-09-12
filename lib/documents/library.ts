import type {
  DocumentListing,
  DocumentsGateway,
  StoredDocument,
} from './store';

/**
 * Everything the library screen is allowed to reach: the reader's own document
 * rows, and nothing else.
 *
 * There is no model client in here and no way to add one. Reopening a document
 * hands back a read that already happened, so a library that could reach the
 * model would be a library that might re-read a document the reader only wanted
 * to look at again — a second opinion they did not ask for, paid for, and
 * waited for. Keeping the model out of the type is what makes that impossible
 * rather than merely unlikely.
 */
export interface LibraryDeps {
  documents: DocumentsGateway;
}

/** One line of the library: enough to recognise a document and reopen it. */
export interface LibraryEntry {
  id: string;
  name: string;
  /** The date the reader would recognise it by, in their own calendar words. */
  savedOn: string;
  /** The same moment, machine-readable, for the `time` element. */
  savedAt: string;
  /** Whether the row already holds an analysis to show. */
  read: boolean;
}

/** What a row shows for a date the column cannot be read as one. */
export const DATE_UNKNOWN = 'Date not recorded';

/**
 * The reader's library, newest first.
 *
 * The order is settled here as well as in the query. The screen promises the
 * reader that the top of the list is the last thing they read, and a promise
 * that lives only in an `order by` is one a second caller can break without
 * noticing.
 */
export async function listLibrary(deps: LibraryDeps): Promise<LibraryEntry[]> {
  return libraryEntries(await deps.documents.list());
}

/**
 * One stored document, read back exactly as it was kept. No model is called
 * here — see `LibraryDeps`.
 */
export async function openFromLibrary(
  deps: LibraryDeps,
  id: string,
): Promise<StoredDocument | null> {
  return deps.documents.byId(id);
}

/**
 * Takes a document out of the library for good: the extracted text and the
 * analysis go together, because they are one row. Returns false when the id
 * names nothing of this reader's, so the screen can say so instead of reporting
 * a deletion that never happened.
 */
export async function forgetDocument(
  deps: LibraryDeps,
  id: string,
): Promise<boolean> {
  return deps.documents.remove(id);
}

/** The listings as the screen shows them: newest first, dates in words. */
export function libraryEntries(listings: DocumentListing[]): LibraryEntry[] {
  return [...listings]
    .sort((a, b) => savedMoment(b.createdAt) - savedMoment(a.createdAt))
    .map((listing) => ({
      id: listing.id,
      name: listing.name,
      savedOn: readableDate(listing.createdAt),
      savedAt: listing.createdAt,
      read: listing.analysed,
    }));
}

/**
 * A stored timestamp as a moment in time. A row whose date cannot be read sorts
 * to the bottom rather than throwing: the reader still needs to get at their
 * document, and a library that refuses to open over one unreadable column is
 * worse than one that puts that document last.
 */
function savedMoment(iso: string): number {
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? 0 : at;
}

/** A stored timestamp in the words a reader would use for that day. */
export function readableDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return DATE_UNKNOWN;
  return at.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
