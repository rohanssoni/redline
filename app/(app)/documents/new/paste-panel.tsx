'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pastedImageReason, readPaste } from '@/lib/parsing/pasted-text';
import { saveDocument } from '@/lib/documents/save-document';

type Step =
  | { at: 'waiting' }
  | { at: 'saving' }
  | { at: 'refused'; reason: string };

/**
 * The alternative way in: the reader's own text, for when they have the wording
 * but not the file. What they paste is stored as it stands, so it is exactly
 * what every source sentence is checked against (ADR-0001), and what leaves here
 * is the same shape an upload produces.
 *
 * Upload leads and this follows, which is the product decision recorded in
 * ADR-0020 and not a choice about layout.
 */
export function PastePanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<Step>({ at: 'waiting' });
  const box = useRef<HTMLTextAreaElement>(null);

  const busy = step.at === 'saving';

  async function send() {
    const paste = readPaste({ name, text });
    if (paste.document === undefined) {
      setStep({ at: 'refused', reason: paste.refused });
      return;
    }

    setStep({ at: 'saving' });
    const outcome = await saveDocument(paste.document);
    if (!outcome.saved) {
      setStep({ at: 'refused', reason: outcome.reason });
      return;
    }
    router.push(`/documents/${outcome.id}`);
  }

  if (!open) {
    return (
      <button
        className="link-button"
        type="button"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => box.current?.focus(), 0);
        }}
      >
        Paste the text instead
      </button>
    );
  }

  return (
    <form
      className="paste"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) void send();
      }}
    >
      <h2>Paste the text</h2>
      <label className="paste-label" htmlFor="pasted-text">
        The wording of the agreement
      </label>
      <textarea
        ref={box}
        id="pasted-text"
        rows={10}
        value={text}
        disabled={busy}
        onChange={(event) => {
          setText(event.target.value);
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

      <label className="paste-label" htmlFor="pasted-name">
        What to call it
      </label>
      <input
        id="pasted-name"
        type="text"
        value={name}
        disabled={busy}
        placeholder="Leave this empty and Redline uses the first line."
        onChange={(event) => setName(event.target.value)}
      />

      <div className="state-actions">
        <button className="link-button" type="submit" disabled={busy || text.trim() === ''}>
          {busy ? 'Sending the text' : 'Read this text'}
        </button>
        <button
          className="link-button"
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setStep({ at: 'waiting' });
          }}
        >
          Upload a file instead
        </button>
      </div>

      {step.at === 'refused' ? (
        <div className="state" data-tone="refused" role="alert">
          <p className="state-title">Redline can’t read that</p>
          <p>{step.reason}</p>
        </div>
      ) : null}
    </form>
  );
}
