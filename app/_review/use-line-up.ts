'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** A finding's reading folds open and shut over this long (globals.css `--fold`). */
export const FOLD_MS = 280;

/** Where the findings list sits beside the page rather than above it (globals.css). */
const BESIDE_THE_PAGE = '(min-width: 1280px)';

export interface Leader {
  top: number;
  left: number;
  width: number;
}

/**
 * Keeps the findings list and the marked-up page in step (ADR-0024).
 *
 * Picking an entry lines it up: the page scrolls until the flag's source
 * sentence, or the gap's note at the foot of the page, sits level with the entry,
 * and a dotted line joins the two. Hovering an entry draws the same line and
 * marks the sentence without moving the page. Picking a mark on the page picks
 * its entry without scrolling, because the reader is already looking at it.
 *
 * Where the list sits above the page, on a narrow screen, nothing can be level
 * with anything, so a pick scrolls the target into view if it is not already.
 *
 * Findings are keyed by rank, which both orders of the list share.
 */
export function useLineUp(initialRank: number | null) {
  const [focusRank, setFocusRank] = useState<number | null>(initialRank);
  const [hoverRank, setHoverRank] = useState<number | null>(null);
  const [leader, setLeader] = useState<Leader | null>(null);
  const [settled, setSettled] = useState(0);
  const entries = useRef(new Map<number, HTMLElement>());
  const targets = useRef(new Map<number, HTMLElement>());
  const timers = useRef<number[]>([]);

  const entryRef = useCallback(
    (rank: number) => (el: HTMLElement | null) => keep(entries.current, rank, el),
    [],
  );
  const targetRef = useCallback(
    (rank: number) => (el: HTMLElement | null) => keep(targets.current, rank, el),
    [],
  );

  const pick = useCallback((rank: number) => {
    setFocusRank(rank);
    timers.current.forEach((timer) => window.clearTimeout(timer));
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';

    function align() {
      const entry = entries.current.get(rank);
      const target = targets.current.get(rank);
      if (!target) return;
      if (entry && window.matchMedia(BESIDE_THE_PAGE).matches) {
        // The entry's first line is the line the target is brought level with.
        const delta = target.getBoundingClientRect().top - entry.getBoundingClientRect().top;
        if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior });
      } else {
        const top = target.getBoundingClientRect().top;
        if (top < 72 || top > window.innerHeight * 0.6) {
          target.scrollIntoView({ block: 'center', behavior });
        }
      }
      setSettled((n) => n + 1);
    }

    // Once the list and the page have rendered the new pick, and again once the
    // previous reading has folded shut and moved everything below it.
    timers.current.length = 0;
    timers.current.push(window.setTimeout(align, 60), window.setTimeout(align, FOLD_MS + 420));
  }, []);

  const focusFromPage = useCallback((rank: number) => setFocusRank(rank), []);

  // The line is drawn from the hovered entry if there is one, else the picked one.
  const shown = hoverRank ?? focusRank;
  useLayoutEffect(() => {
    function draw() {
      const entry = shown === null ? undefined : entries.current.get(shown);
      const target = shown === null ? undefined : targets.current.get(shown);
      if (!entry || !target || !window.matchMedia(BESIDE_THE_PAGE).matches) {
        return setLeader(null);
      }
      const a = entry.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight) return setLeader(null);
      const y = a.top + 13;
      if (y < b.top - 4 || y > b.bottom + 4) return setLeader(null);
      setLeader({ top: y, left: a.right + 6, width: Math.max(0, b.left - a.right - 22) });
    }
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw);
    return () => {
      window.removeEventListener('scroll', draw);
      window.removeEventListener('resize', draw);
    };
  }, [shown, settled]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return { focusRank, hoverRank, setHoverRank, pick, focusFromPage, entryRef, targetRef, leader };
}

function keep(map: Map<number, HTMLElement>, rank: number, el: HTMLElement | null) {
  if (el) map.set(rank, el);
  else map.delete(rank);
}
