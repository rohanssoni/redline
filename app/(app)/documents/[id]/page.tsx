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
            {analysis.flags.length === 0
              ? 'No clause here lets the other side change your terms on its own. The whole agreement is below.'
              : `${flagCount(analysis.flags.length)} Each one quotes the sentence it comes from, so you can check it yourself.`}
          </p>
        )}
      </section>

      {analysis ? (
        <DocumentReview
          name={document.name}
          text={document.text}
          flags={analysis.flags}
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

/** How many flags there are, in words a reader would use. */
function flagCount(count: number): string {
  if (count === 1) return 'One clause here could cost you.';
  return `${count} clauses here could cost you, worst first.`;
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
