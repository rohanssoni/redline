import type { Metadata } from 'next';
import type { RedLine } from '@/lib/red-lines/store';
import { createSupabaseRedLines } from '@/lib/red-lines/supabase-red-lines';
import { currentReader } from '@/lib/supabase/server';
import { RedLinesEditor } from './red-lines-editor';

export const metadata: Metadata = { title: 'Red lines — Redline' };

type Listing = { redLines: RedLine[] } | { problem: string };

async function loadRedLines(): Promise<Listing> {
  const reader = await currentReader();
  if (!reader) return { redLines: [] };

  try {
    const redLines = await createSupabaseRedLines(
      reader.supabase,
      reader.user.id,
    ).list();
    return { redLines };
  } catch (error) {
    console.error('A reader’s red lines could not be read', error);
    return {
      problem: 'Your red lines didn’t load. Reload the page and they should be back.',
    };
  }
}

export default async function RedLinesPage() {
  const listing = await loadRedLines();

  return (
    <section className="sheet">
      <p className="sheet-label">
        <span>Red lines</span>
        <span>Yours, on every document</span>
      </p>
      <h1>What you won’t sign</h1>

      <div className="sheet-body">
        <p>
          A red line is a term you’ve already decided you won’t accept. Redline
          reads this list every time it reads a document, and a clause that
          crosses one of these gets flagged even when it would otherwise pass as
          ordinary.
        </p>
        <p className="note">
          Write them the way you’d say them out loud. Redline matches on what you
          meant, so a clause can cross a red line without using any of your
          words.
        </p>
      </div>

      {'problem' in listing ? (
        <div className="state" data-tone="refused" role="alert">
          <p className="state-title">{listing.problem}</p>
        </div>
      ) : (
        <>
          {listing.redLines.length === 0 ? <NoRedLinesYet /> : null}
          <RedLinesEditor redLines={listing.redLines} />
        </>
      )}
    </section>
  );
}

/**
 * The empty state. Redline reads a document perfectly well without a red line,
 * so this says what a list adds rather than treating its absence as a fault.
 */
function NoRedLinesYet() {
  return (
    <div className="state red-lines-empty" role="status">
      <p className="state-title">Nothing on your list yet</p>
      <p>
        Redline reads every document the same way with or without one, and flags
        what could cost you. A red line adds what only you know: the rate you
        won’t go under, or the work you have to be able to show people.
      </p>
    </div>
  );
}
