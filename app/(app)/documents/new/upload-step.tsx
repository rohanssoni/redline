'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DocumentReadError,
  extractDocumentText,
} from '@/lib/parsing/extract-document-text';

type Step =
  | { at: 'waiting' }
  | { at: 'reading'; fileName: string }
  | { at: 'saving'; fileName: string }
  | { at: 'refused'; reason: string };

/**
 * Where a file becomes text. The parsing happens here, in the reader's browser;
 * what leaves this component is the extracted text and the file's name, and the
 * file itself stays on the reader's machine (`CLAUDE.md`, settled).
 */
export function UploadStep() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ at: 'waiting' });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const busy = step.at === 'reading' || step.at === 'saving';

  async function take(file: File) {
    setStep({ at: 'reading', fileName: file.name });
    let extracted;
    try {
      extracted = await extractDocumentText(file);
    } catch (error) {
      setStep({
        at: 'refused',
        reason:
          error instanceof DocumentReadError
            ? error.message
            : 'Redline couldn’t finish reading that file. Try it again, or send a PDF exported from the original.',
      });
      return;
    }

    setStep({ at: 'saving', fileName: extracted.name });
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: extracted.name, text: extracted.text }),
      });
      const body = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !body.id) {
        setStep({
          at: 'refused',
          reason: body.error ?? 'The document couldn’t be saved. Try it again.',
        });
        return;
      }
      router.push(`/documents/${body.id}`);
    } catch {
      setStep({
        at: 'refused',
        reason:
          'Redline couldn’t be reached. Check your connection and send the file again.',
      });
    }
  }

  return (
    <section className="sheet">
      <p className="sheet-label">
        <span>New document</span>
      </p>
      <h1>Read an agreement</h1>
      <div className="sheet-body">
        <p>
          Your browser opens the file and sends Redline the words in it. The file
          stays on your computer.
        </p>
      </div>

      <div
        className="drop"
        data-over={over}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file && !busy) void take(file);
        }}
      >
        <label className="file-name" htmlFor="document-file">
          Choose a PDF or Word file, or drop one here
        </label>
        <input
          ref={input}
          id="document-file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void take(file);
          }}
        />
        <p className="drop-hint">
          PDF or .docx. A scan or a photo of a page has no words in it to read, so
          Redline turns those down.
        </p>
      </div>

      {step.at === 'reading' ? (
        <div className="state" role="status">
          <p className="state-title">Opening {step.fileName}</p>
          <p>Reading the words out of the file.</p>
        </div>
      ) : null}

      {step.at === 'saving' ? (
        <div className="state" role="status">
          <p className="state-title">Sending the text of {step.fileName}</p>
          <p>Only the words go to Redline. The file stays on your computer.</p>
        </div>
      ) : null}

      {step.at === 'refused' ? (
        <div className="state" data-tone="refused" role="alert">
          <p className="state-title">Redline can’t read that one</p>
          <p>{step.reason}</p>
          <div className="state-actions">
            <button
              className="link-button"
              type="button"
              onClick={() => {
                setStep({ at: 'waiting' });
                if (input.current) input.current.value = '';
                input.current?.click();
              }}
            >
              Choose another file
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
