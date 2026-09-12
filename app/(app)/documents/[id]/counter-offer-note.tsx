'use client';

import { useEffect, useState } from 'react';
import type { CounterOfferClaim, Stance } from '@/lib/analysis/types';

const COPIED_MS = 2200;

/** What came back when the reader asked for the firmer wording. */
export interface FirmDraft {
  text?: string;
  error?: string;
}

/**
 * The counter-offer under one flag: replacement wording for that clause alone,
 * the stance it is written in, and a way to take it (CONTEXT.md: counter-offer,
 * stance).
 *
 * It sits inside the flag's comment, under the reading and next to the sentence
 * it rewrites, because the reader judges a rewrite by rereading what it replaces.
 * Nothing renders it for a gap — a gap has no counter-offer to pass in
 * (ADR-0014).
 *
 * Soft is what the read drafted, so soft is what shows. Firm is written the
 * moment the reader asks for it and not before (ADR-0012), which is why asking
 * takes a few seconds and says so. The stance lives in this component, one per
 * flag, so choosing firm here reaches no other flag on the page.
 *
 * `onCopied` is how a copy gets counted. Copying is the closest Redline can get
 * to watching a draft be sent, so it is what the primary success metric is built
 * on — recorded and reported as a copy, never as a confirmed send. It fires only
 * after the wording actually reached the clipboard, and the copy works whether
 * or not anyone is listening.
 */
export function CounterOfferNote({
  soft,
  firm,
  onDraftFirm,
  onCopied,
}: {
  soft: CounterOfferClaim;
  /** The firm draft this flag already has, from an earlier ask. */
  firm?: CounterOfferClaim;
  /** Asks for the firm wording. Called once per flag, on the first switch. */
  onDraftFirm: () => Promise<FirmDraft>;
  onCopied?: (counterOffer: CounterOfferClaim) => void;
}) {
  const [stance, setStance] = useState<Stance>('soft');
  const [firmText, setFirmText] = useState<string | null>(firm?.text ?? null);
  const [drafting, setDrafting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const showing: CounterOfferClaim =
    stance === 'firm' && firmText !== null
      ? { ...soft, stance: 'firm', text: firmText }
      : soft;

  async function chooseSoft() {
    setProblem(null);
    setStance('soft');
    setCopied(false);
  }

  async function chooseFirm() {
    setCopied(false);
    setProblem(null);

    // Already drafted, here or on an earlier visit: nothing is asked for again.
    if (firmText !== null) {
      setStance('firm');
      return;
    }

    setDrafting(true);
    const result = await onDraftFirm();
    setDrafting(false);

    if (result.text) {
      setFirmText(result.text);
      setStance('firm');
      return;
    }
    // The soft wording stays exactly where it was, and stays on screen.
    setProblem(
      result.error ??
        'The firmer wording didn’t come back. The wording below still stands, and you can ask again.',
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(showing.text);
      setCopied(true);
      onCopied?.(showing);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="counter-offer">
      <p className="counter-offer-label">Wording you could send back</p>

      <div className="stance-switch" role="group" aria-label="How hard this asks">
        <button
          type="button"
          className="stance-option"
          aria-pressed={stance === 'soft'}
          onClick={() => void chooseSoft()}
        >
          Soft
        </button>
        <button
          type="button"
          className="stance-option"
          aria-pressed={stance === 'firm'}
          aria-busy={drafting}
          disabled={drafting}
          onClick={() => void chooseFirm()}
        >
          Firm
        </button>
      </div>

      {drafting && (
        <p className="stance-state" role="status">
          Writing the firmer version. It takes a few seconds.
        </p>
      )}

      {problem && (
        <p className="stance-state" data-tone="refused" role="alert">
          {problem}
        </p>
      )}

      <p className="counter-offer-text">{showing.text}</p>
      <div className="counter-offer-actions">
        <button className="link-button" type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
