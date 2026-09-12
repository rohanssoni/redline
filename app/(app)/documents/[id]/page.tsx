import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createSupabaseDocuments } from '@/lib/documents/supabase-documents';
import type { StoredDocument } from '@/lib/documents/store';
import { currentReader } from '@/lib/supabase/server';
import { AnalysisRunner } from './analysis-runner';

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

  return (
    <>
      <section className="sheet">
        <p className="sheet-label">
          <span>{document.name}</span>
          <span>Read on {readableDate(document.createdAt)}</span>
        </p>
        <h1>What this agreement says</h1>

        {document.analysis ? (
          <div className="summary">
            {paragraphs(document.analysis.summary).map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <AnalysisRunner documentId={document.id} />
        )}

        <p className="note sheet-foot">
          This is what the agreement says, in plain words. The clauses that could
          cost you, each with the sentence it comes from, come next.
        </p>
      </section>

      <section className="doc-page" aria-label="The text of your agreement">
        <p className="doc-label">Your document, as Redline read it</p>
        {paragraphs(document.text).map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
        ))}
      </section>
    </>
  );
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
