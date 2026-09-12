'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Run =
  | { at: 'reading' }
  | { at: 'done' }
  | { at: 'failed'; reason: string };

/**
 * Runs the analysis for a document that has none yet, and shows what is
 * happening while it runs. A run that fails says so: it is never shown as a
 * document with nothing to flag (ADR-0008).
 */
export function AnalysisRunner({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [run, setRun] = useState<Run>({ at: 'reading' });
  const started = useRef(false);

  async function analyse() {
    setRun({ at: 'reading' });
    try {
      const response = await fetch(`/api/documents/${documentId}/analysis`, {
        method: 'POST',
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setRun({
          at: 'failed',
          reason:
            body.error ??
            'The read didn’t finish. Your document is saved, so you can start it again.',
        });
        return;
      }
      setRun({ at: 'done' });
      router.refresh();
    } catch {
      setRun({
        at: 'failed',
        reason:
          'Redline couldn’t be reached. Your document is saved, so you can start the read again.',
      });
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void analyse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  if (run.at === 'failed') {
    return (
      <div className="state" data-tone="refused" role="alert">
        <p className="state-title">Redline didn’t get through this one</p>
        <p>{run.reason}</p>
        <div className="state-actions">
          <button className="link-button" type="button" onClick={() => void analyse()}>
            Read it again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="state" role="status">
      <p className="state-title">Reading your agreement</p>
      <p>It takes a few seconds. The summary appears here when it’s done.</p>
    </div>
  );
}
