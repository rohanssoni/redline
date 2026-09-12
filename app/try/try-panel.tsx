'use client';

import { useRef, useState } from 'react';
import {
  DocumentReadError,
  extractDocumentText,
} from '@/lib/parsing/extract-document-text';
import { pastedImageReason, readPaste } from '@/lib/parsing/pasted-text';
import {
  LEAVING_LOSES_IT,
  WHAT_AN_ACCOUNT_ADDS,
} from '@/lib/anonymous/try-limits';
import type { AnonymousRead } from '@/lib/anonymous/try-document';
import { KeepForm } from './keep-form';
import { TryReview } from './try-review';

type Step =
  | { at: 'waiting' }
  | { at: 'reading'; fileName: string }
  | { at: 'analysing'; fileName: string }
  | { at: 'refused'; reason: string }
  | { at: 'read'; name: string; text: string; read: AnonymousRead };

/**
 * The try itself: a file the browser opens, or text the visitor pastes, and the
 * read that comes back.
 *
 * The text is held here, in this tab, for as long as the visitor keeps the page
 * open. It is sent with the request that reads it and there is nothing here that
 * saves it — no document id comes back, because nothing was saved to have one.
 * Reloading the page loses it, which is what not storing something means.
 */
export function TryPanel() {
  const [step, setStep] = useState<Step>({ at: 'waiting' });
  const [over, setOver] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const busy = step.at === 'reading' || step.at === 'analysing';

  async function read(name: string, text: string) {
    setStep({ at: 'analysing', fileName: name });

    let response: Response;
    try {
      response = await fetch('/api/try', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch {
      setStep({
        at: 'refused',
        reason:
          'Redline couldn’t be reached. Check your connection and send it again.',
      });
      return;
    }

    let body: { read?: AnonymousRead; text?: string; error?: string };
    try {
      body = (await response.json()) as {
        read?: AnonymousRead;
        text?: string;
        error?: string;
      };
    } catch {
      body = {};
    }

    if (!response.ok || !body.read || typeof body.text !== 'string') {
      setStep({
        at: 'refused',
        reason:
          body.error ??
          'The read didn’t finish. Nothing was saved, so you can start it again.',
      });
      return;
    }

    // The text that comes back, not the text that went up. They differ by the
    // one normalisation on the way in, and this is the string every flag was
    // checked against — so it is the one the page marks up, and the one that
    // gets stored if the visitor makes an account.
    setStep({ at: 'read', name, text: body.text, read: body.read });
  }

  async function take(file: File) {
    setStep({ at: 'reading', fileName: file.name });
    try {
      const extracted = await extractDocumentText(file);
      await read(extracted.name, extracted.text);
    } catch (error) {
      setStep({
        at: 'refused',
        reason:
          error instanceof DocumentReadError
            ? error.message
            : 'Redline couldn’t finish reading that file. Try it again, or send a PDF exported from the original.',
      });
    }
  }

  function sendPaste() {
    const paste = readPaste({ name: '', text: pasted });
    if (paste.document === undefined) {
      setStep({ at: 'refused', reason: paste.refused });
      return;
    }
    void read(paste.document.name, paste.document.text);
  }

  if (step.at === 'read') {
    return (
      <>
        <TryReview
          name={step.name}
          text={step.text}
          summary={step.read.summary}
          flags={step.read.flags}
          gaps={step.read.gaps}
          cleanRead={step.read.cleanRead}
        />

        <section className="try-account" aria-labelledby="try-account-heading">
          {/* First thing under the result, while the document is still here to
              keep. After the tab is closed this sentence has nothing to offer. */}
          <div className="try-keep-warning" role="note">
            <p className="try-keep-warning-title">This read is only in this tab</p>
            <p>{LEAVING_LOSES_IT}</p>
          </div>

          <h2 id="try-account-heading">Keep this read</h2>
          <ul className="try-account-list">
            {WHAT_AN_ACCOUNT_ADDS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <KeepForm name={step.name} text={step.text} read={step.read} />

          <p className="try-keep-note">
            Your account is made and this read goes into it as it stands.
            Redline doesn’t read the document again, so what’s in your library
            is word for word what’s on this page.
          </p>

          <button
            className="link-button"
            type="button"
            onClick={() => {
              setStep({ at: 'waiting' });
              setPasted('');
              setPasting(false);
            }}
          >
            Read another one
          </button>
        </section>
      </>
    );
  }

  return (
    <section className="try-panel">
      <div
        className="try-drop"
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
        <label className="try-file-label" htmlFor="try-file">
          Choose a PDF or Word file, or drop one here
        </label>
        <input
          ref={input}
          id="try-file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void take(file);
          }}
        />
        <p className="try-hint">
          Your browser opens the file and sends Redline the words in it. The file
          stays on your computer, and the words aren’t saved anywhere.
        </p>
      </div>

      {step.at === 'reading' && (
        <div className="try-state" role="status">
          <p className="try-state-title">Opening {step.fileName}</p>
          <p>Reading the words out of the file.</p>
        </div>
      )}

      {step.at === 'analysing' && (
        <div className="try-state" role="status">
          <p className="try-state-title">Reading {step.fileName}</p>
          <p>It takes a few seconds. The summary and the flags appear here.</p>
        </div>
      )}

      {step.at === 'refused' && (
        <div className="try-state" data-tone="refused" role="alert">
          <p className="try-state-title">Redline didn’t read that one</p>
          <p>{step.reason}</p>
          <div className="try-state-actions">
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
      )}

      <div className="try-alt">
        <p className="try-note">
          Uploading gives you the most faithful source sentences. Redline checks
          every sentence it quotes against the text you give it, and text copied
          out of a PDF can come across with lines broken in odd places or two
          columns run together. A quote would still match your paste word for
          word, and not match the agreement you are signing.
        </p>

        {!pasting ? (
          <button
            className="link-button"
            type="button"
            onClick={() => {
              setPasting(true);
              window.setTimeout(() => box.current?.focus(), 0);
            }}
          >
            Paste the text instead
          </button>
        ) : (
          <form
            className="try-paste"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) sendPaste();
            }}
          >
            <label className="try-paste-label" htmlFor="try-pasted-text">
              The wording of the agreement
            </label>
            <textarea
              ref={box}
              id="try-pasted-text"
              rows={10}
              value={pasted}
              disabled={busy}
              onChange={(event) => {
                setPasted(event.target.value);
                if (step.at === 'refused') setStep({ at: 'waiting' });
              }}
              onPaste={(event) => {
                const refusal = pastedImageReason(
                  Array.from(event.clipboardData.items)
                    .filter((item) => item.kind === 'file')
                    .map((item) => item.type),
                );
                if (refusal === null) return;
                event.preventDefault();
                setStep({ at: 'refused', reason: refusal });
              }}
            />
            <div className="try-state-actions">
              <button
                className="link-button"
                type="submit"
                disabled={busy || pasted.trim() === ''}
              >
                {busy ? 'Reading it' : 'Read this text'}
              </button>
              <button
                className="link-button"
                type="button"
                disabled={busy}
                onClick={() => setPasting(false)}
              >
                Upload a file instead
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
