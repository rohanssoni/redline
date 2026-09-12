'use client';

import { useEffect, useState } from 'react';
import type { CounterOfferClaim } from '@/lib/analysis/types';

const COPIED_MS = 2200;

/**
 * The counter-offer under one flag: replacement wording for that clause alone,
 * and a way to take it (CONTEXT.md: counter-offer).
 *
 * It sits inside the flag's comment, under the reading and next to the sentence
 * it rewrites, because the reader judges a rewrite by rereading what it replaces.
 * Nothing renders it for a gap — a gap has no counter-offer to pass in
 * (ADR-0014).
 *
 * `onCopied` is the seam a later ticket reads to count how often a draft is
 * actually sent. Nothing counts anything today, and the copy works whether or not
 * anyone is listening.
 */
export function CounterOfferNote({
  counterOffer,
  onCopied,
}: {
  counterOffer: CounterOfferClaim;
  onCopied?: (counterOffer: CounterOfferClaim) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(counterOffer.text);
      setCopied(true);
      onCopied?.(counterOffer);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="counter-offer">
      <p className="counter-offer-label">Wording you could send back</p>
      <p className="counter-offer-text">{counterOffer.text}</p>
      <div className="counter-offer-actions">
        <button className="link-button" type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
