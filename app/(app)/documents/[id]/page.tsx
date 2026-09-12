import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import type { StoredDocument } from '@/lib/documents/store';
import { currentReader } from '@/lib/supabase/server';
import { AnalysisRunner } from './analysis-runner';
import { DocumentReview } from './document-review';

export const metadata: Metadata = { title: 'Document — Redline' };

async function loadDocument(id: string): Promise<StoredDocument | null> {
  const reader = await currentReader();
  if (!reader) return null;
  return createSupabaseDocuments(reader.supabase, reader.user.id).byId(id);
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await loadDocument(id);
  if (!document) notFound();

  const { analysis } = document;

  return (
    <>
      <section className="sheet">
        <p className="sheet-label">
          <span>{document.name}</span>
          <span>Read on {readableDate(document.createdAt)}</span>
        </p>
        <h1>What this agreement says</h1>

        {analysis ? (
          <div className="summary">
            {paragraphs(analysis.summary).map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <AnalysisRunner documentId={document.id} />
        )}

        {analysis && (
          <p className="note sheet-foot">
            {whatRedlineFound(analysis.flags.length, analysis.gaps.length)}
          </p>
        )}
      </section>

      {analysis ? (
        <DocumentReview
          name={document.name}
          text={document.text}
          flags={analysis.flags}
          gaps={analysis.gaps}
        />
      ) : (
        <section className="doc-page" aria-label="The text of your agreement">
          <p className="doc-label">Your document, as Redline read it</p>
          {paragraphs(document.text).map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
          ))}
        </section>
      )}
    </>
  );
}

/**
 * What the read turned up, in words a reader would use. Flags and gaps are
 * counted separately here because they are different claims: a flag quotes a
 * sentence and a gap says a sentence is missing (ADR-0005). They are ranked
 * together below, on the page itself.
 */
function whatRedlineFound(flags: number, gaps: number): string {
  if (flags === 0 && gaps === 0) {
    return 'No clause here lets the other side change your terms on its own, and Redline found no gaps. The whole agreement is below.';
  }
  if (flags === 0) {
    return `No clause here lets the other side change your terms on its own. ${gapCount(gaps)}`;
  }
  const found = `${flagCount(flags)} Each one quotes the sentence it comes from, so you can check it yourself.`;
  return gaps === 0 ? found : `${found} ${gapCount(gaps)}`;
}

/** How many flags there are, in words a reader would use. */
function flagCount(count: number): string {
  if (count === 1) return 'One clause here could cost you.';
  return `${count} clauses here could cost you, worst first.`;
}

/** The same for gaps, which have no sentence to quote. */
function gapCount(count: number): string {
  if (count === 1) return 'One gap is in the list below.';
  return `${count} gaps are in the list below.`;
}

function paragraphs(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function readableDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
