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
  /** True while it previews a hovered finding rather than joining the picked one. */
  hover: boolean;
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
  // Bumped after each scroll settles, so the line is redrawn where things ended up.
  const [, setSettled] = useState(0);
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

  const behavior = (): ScrollBehavior =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  /** Replaces any scroll still waiting from an earlier pick, so it cannot pull the page back. */
  const schedule = useCallback((...steps: [() => void, number][]) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.length = 0;
    for (const [step, ms] of steps) timers.current.push(window.setTimeout(step, ms));
  }, []);

  /** Where nothing can sit level, keep the target on screen, as a narrow screen does. */
  const keepInView = useCallback((rank: number) => {
    const target = targets.current.get(rank);
    if (!target) return;
    const top = target.getBoundingClientRect().top;
    if (top < 72 || top > window.innerHeight * 0.6) {
      target.scrollIntoView({ block: 'center', behavior: behavior() });
    }
    setSettled((n) => n + 1);
  }, []);

  const pick = useCallback(
    (rank: number) => {
      setFocusRank(rank);

      function align() {
        const entry = entries.current.get(rank);
        const target = targets.current.get(rank);
        if (!target) return;
        if (!entry || !window.matchMedia(BESIDE_THE_PAGE).matches) return keepInView(rank);
        // The entry's first line is the line the target is brought level with.
        const delta = target.getBoundingClientRect().top - entry.getBoundingClientRect().top;
        if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: behavior() });
        setSettled((n) => n + 1);
      }

      // Once the list and the page have rendered the new pick, and again once the
      // previous reading has folded shut and moved everything below it.
      schedule([align, 60], [align, FOLD_MS + 420]);
    },
    [schedule, keepInView],
  );

  // Picking a mark on the page picks its entry. Where the list scrolls on its
  // own beside the page, the entry is brought into the list's view. The page
  // moves only if the reading folding shut above the mark carries it off screen.
  const focusFromPage = useCallback(
    (rank: number) => {
      setFocusRank(rank);
      schedule([() => keepInView(rank), FOLD_MS + 20]);
      const entry = entries.current.get(rank);
      const list = entry?.closest<HTMLElement>('.rank-index-sticky');
      if (!entry || !list || !window.matchMedia(BESIDE_THE_PAGE).matches) return;
      const e = entry.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      if (e.top < l.top) list.scrollTop -= l.top - e.top;
      else if (e.bottom > l.bottom) list.scrollTop += e.bottom - l.bottom;
    },
    [schedule, keepInView],
  );

  // The line is drawn from the hovered entry if there is one, else the picked one.
  const shown = hoverRank ?? focusRank;
  const draw = useRef(() => {});
  draw.current = () => {
    const entry = shown === null ? undefined : entries.current.get(shown);
    const target = shown === null ? undefined : targets.current.get(shown);
    let next: Leader | null = null;
    if (entry && target && window.matchMedia(BESIDE_THE_PAGE).matches) {
      const a = entry.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const y = a.top + 13;
      const onScreen = b.bottom >= 0 && b.top <= window.innerHeight;
      if (onScreen && y >= b.top - 4 && y <= b.bottom + 4) {
        next = {
          top: y,
          left: a.right + 6,
          width: Math.max(0, b.left - a.right - 22),
          hover: shown !== focusRank,
        };
      }
    }
    setLeader((was) => (sameLeader(was, next) ? was : next));
  };

  // After every render, because switching the order moves the entries without
  // anything else here changing.
  useLayoutEffect(() => draw.current());

  // Capture, so a scroll inside the list as well as the page's own redraws it.
  useEffect(() => {
    const redraw = () => draw.current();
    window.addEventListener('scroll', redraw, { passive: true, capture: true });
    window.addEventListener('resize', redraw);
    const pending = timers.current;
    return () => {
      window.removeEventListener('scroll', redraw, { capture: true });
      window.removeEventListener('resize', redraw);
      pending.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return { focusRank, hoverRank, setHoverRank, pick, focusFromPage, entryRef, targetRef, leader };
}

function sameLeader(a: Leader | null, b: Leader | null) {
  if (a === null || b === null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.hover === b.hover;
}

function keep(map: Map<number, HTMLElement>, rank: number, el: HTMLElement | null) {
  if (el) map.set(rank, el);
  else map.delete(rank);
}
