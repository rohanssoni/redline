'use client';

// PROTOTYPE, throw away. Three ways for the ranked list and the page to stay in
// step. Everything visual is the existing review markup (.rank-index, .page,
// .flagged, .comment) from globals.css and try.css. Only the sync behaviour and
// where the list sits change between variants.
//
//   A  Follow along: the list stays in the margin as you scroll. Picking an item
//      brings its sentence to the middle of the screen. The item for the
//      sentence you are reading is marked as you scroll.
//   B  Line up: picking an item scrolls the page so the sentence sits level
//      with the item, joined by a dotted crimson leader.
//   C  Step through: the list folds into a bar pinned to the top of the page,
//      with previous and next, and the full list one click away.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { markUpDocument, textLines } from '@/lib/analysis/marked-document';
import { rankFindings } from '@/lib/analysis/ranking';
import type { Gap, VerifiedFlag } from '@/lib/analysis/types';
import fixture from './fixture.json';
import { PrototypeSwitcher } from './prototype-switcher';

const VARIANTS = [
  { key: 'A', name: 'Follow along' },
  { key: 'B', name: 'Line up' },
  { key: 'C', name: 'Step through' },
];

const flags = fixture.flags as unknown as VerifiedFlag[];
const gaps = fixture.gaps as unknown as Gap[];

/** Everything the three variants share: ranking, markup, and where each finding sits. */
function useRead() {
  const findings = useMemo(() => rankFindings(flags, gaps), []);
  const flagRanks = useMemo(
    () =>
      new Map(
        findings.filter((f) => f.kind === 'flag').map((f) => [f.id, f.rank]),
      ),
    [findings],
  );
  const { pieces, marked } = useMemo(
    () => markUpDocument(fixture.text, flags, (flag, i) => flagRanks.get(flag.id) ?? i + 1),
    [flagRanks],
  );
  const onThePage = useMemo(() => new Set(marked.map((m) => m.flag.id)), [marked]);
  const listed = useMemo(
    () => findings.filter((f) => f.kind === 'gap' || onThePage.has(f.id)),
    [findings, onThePage],
  );
  const nodes = useRef(new Map<number, HTMLElement>());
  const register = useCallback(
    (rank: number) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(rank, el);
      else nodes.current.delete(rank);
    },
    [],
  );
  // Flags in the order they appear on the page, then the gaps from the foot.
  const inDocumentOrder = useMemo(() => {
    const byRank = new Map(listed.map((f) => [f.rank, f]));
    // `marked` comes back in rank order; the pieces are the page, top to bottom.
    return [
      ...pieces
        .flatMap((p) => (p.kind === 'flag' ? [byRank.get(p.marked.rank)] : []))
        .filter((f): f is (typeof listed)[number] => !!f),
      ...listed.filter((f) => f.kind === 'gap'),
    ];
  }, [listed, pieces]);
  return { listed, inDocumentOrder, pieces, nodes, register };
}

const BAND_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

type Listed = ReturnType<typeof useRead>['listed'][number];

function findingName(f: Listed) {
  return f.kind === 'flag' ? f.flag.clauseType : f.gap.statement;
}

/** The marked-up page, exactly as the try review draws it, plus hover and refs. */
function Page({
  read,
  focusRank,
  hoverRank,
  onFocus,
  onHover,
  labelFor = (rank) => rank,
}: {
  read: ReturnType<typeof useRead>;
  focusRank: number | null;
  hoverRank: number | null;
  onFocus: (rank: number) => void;
  onHover: (rank: number | null) => void;
  /** The number the reader sees for a finding: its rank, or its place on the page. */
  labelFor?: (rank: number) => number;
}) {
  const gapsListed = read.listed.filter((f) => f.kind === 'gap');
  return (
    <article className="page" aria-label={`${fixture.name}, marked up`}>
      <p className="page-band">Your document. Each flag sits under the sentence it came from.</p>

      {read.pieces.map((piece, index) => {
        if (piece.kind === 'text') {
          return textLines(piece.text).map((line, lineIndex) => (
            <p key={`${index}-${lineIndex}`} className="sentence">
              {line}
            </p>
          ));
        }
        const { flag, rank } = piece.marked;
        const isFocus = rank === focusRank;
        return (
          <div
            key={flag.id}
            ref={read.register(rank)}
            className="flagged"
            data-focus={isFocus}
            data-hover={rank === hoverRank && !isFocus}
            onMouseEnter={() => onHover(rank)}
            onMouseLeave={() => onHover(null)}
          >
            <button
              type="button"
              className="gutter-rank"
              aria-pressed={isFocus}
              aria-label={`Flag ${labelFor(rank)}: ${flag.clauseType}`}
              onClick={() => onFocus(rank)}
            >
              {labelFor(rank)}
            </button>
            <p className="sentence">
              <mark>{piece.text}</mark>
            </p>
            <div className="comment" inert={!isFocus}>
              <div className="comment-body">
                <div className="comment-leader" aria-hidden="true" />
                <div className="comment-inner">
                  <p className="comment-reading">{flag.explanation}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {gapsListed.length > 0 && (
        <div className="page-foot">
          <div className="gap-notes">
            <p className="gap-caption">
              {gapsListed.length} gaps: terms this agreement leaves out. There are no sentences to
              quote, because they aren’t in the document.
            </p>
            {gapsListed.map((f) =>
              f.kind === 'gap' ? (
                <aside
                  key={f.gap.id}
                  ref={read.register(f.rank)}
                  className="gap-note"
                  data-focus={f.rank === focusRank}
                  aria-label={`Gap ${labelFor(f.rank)}: ${f.gap.statement}`}
                >
                  <p className="gap-statement">
                    <span className="gap-rank">{labelFor(f.rank)}</span>
                    {f.gap.statement}
                  </p>
                  <p className="gap-explain">{f.gap.explanation}</p>
                </aside>
              ) : null,
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function Summary() {
  return (
    <div className="try-summary">
      <p className="try-summary-label">What this agreement says</p>
      <p className="try-summary-body">{fixture.summary}</p>
    </div>
  );
}

function IndexList({
  listed,
  focusRank,
  readingRank,
  onPick,
  onHover,
  itemRefs,
  labelFor = (rank) => rank,
  showBand = false,
}: {
  listed: Listed[];
  focusRank: number | null;
  readingRank?: number | null;
  onPick: (rank: number) => void;
  onHover: (rank: number | null) => void;
  itemRefs?: React.RefObject<Map<number, HTMLElement>>;
  labelFor?: (rank: number) => number;
  /** In document order the number no longer says how bad a flag is, so the band does. */
  showBand?: boolean;
}) {
  return (
    <ol aria-labelledby="proto-index-caption">
      {listed.map((f) => (
        <li key={`${f.kind}-${f.id}`}>
          <button
            type="button"
            ref={(el) => {
              if (!itemRefs) return;
              if (el) itemRefs.current.set(f.rank, el);
              else itemRefs.current.delete(f.rank);
            }}
            aria-pressed={f.rank === focusRank}
            data-reading={readingRank === f.rank}
            data-kind={f.kind}
            title={f.kind === 'gap' ? f.gap.statement : undefined}
            onClick={() => onPick(f.rank)}
            onMouseEnter={() => onHover(f.rank)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="rank-slot">{labelFor(f.rank)}</span>
            <span className="rank-text">
              {/* A gap has no sentence on the page, so the list says so before
                  the click takes the reader to the foot of the page. */}
              {f.kind === 'gap' && <span className="proto-gap-tag">Gap</span>}
              {f.kind === 'flag' && showBand && (
                <span className="proto-gap-tag" data-band={f.flag.band}>
                  {BAND_LABEL[f.flag.band] ?? f.flag.band}
                </span>
              )}
              <span className="rank-name">{findingName(f)}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/* A: Follow along ---------------------------------------------------------- */

function VariantA() {
  const read = useRead();
  const [focusRank, setFocusRank] = useState<number | null>(read.listed[0]?.rank ?? null);
  const [hoverRank, setHoverRank] = useState<number | null>(null);
  const [readingRank, setReadingRank] = useState<number | null>(null);
  const focusRef = useRef(focusRank);
  focusRef.current = focusRank;

  function pick(rank: number) {
    setFocusRank(rank);
    setReadingRank(rank);
    // Wait a frame so the comment has started to open, then centre the sentence.
    const centre = () =>
      read.nodes.current.get(rank)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    requestAnimationFrame(centre);
    // Again once the previous comment has folded shut and moved the page.
    setTimeout(() => {
      const box = read.nodes.current.get(rank)?.getBoundingClientRect();
      if (box && Math.abs(box.top + box.height / 2 - window.innerHeight / 2) > 40) centre();
    }, 700);
  }

  // The sentence nearest the middle of the screen is the one being read. While
  // the picked finding is still on screen it stays the one being read, so the
  // list never shows two markers at once.
  useEffect(() => {
    function onScroll() {
      const picked = focusRef.current === null ? undefined : read.nodes.current.get(focusRef.current);
      if (picked) {
        const box = picked.getBoundingClientRect();
        if (box.bottom > 80 && box.top < window.innerHeight) {
          setReadingRank(focusRef.current);
          return;
        }
      }
      const middle = window.innerHeight / 2;
      let best: number | null = null;
      let bestDistance = Infinity;
      read.nodes.current.forEach((el, rank) => {
        const box = el.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) return;
        const distance = Math.abs(box.top + box.height / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = rank;
        }
      });
      setReadingRank(best);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [read.nodes]);

  return (
    <section className="review proto-follow" aria-label="What Redline found">
      <Summary />
      <div className="rank-index">
        <div className="proto-sticky">
          <p className="rank-index-caption" id="proto-index-caption">
            What Redline found, worst first
          </p>
          <IndexList
            listed={read.listed}
            focusRank={focusRank}
            readingRank={readingRank}
            onPick={pick}
            onHover={setHoverRank}
          />
        </div>
      </div>
      <Page
        read={read}
        focusRank={focusRank}
        hoverRank={hoverRank}
        onFocus={setFocusRank}
        onHover={setHoverRank}
      />
    </section>
  );
}

/* B: Line up --------------------------------------------------------------- */

function VariantB() {
  const read = useRead();
  const items = useRef(new Map<number, HTMLElement>());
  const [focusRank, setFocusRank] = useState<number | null>(null);
  const [hoverRank, setHoverRank] = useState<number | null>(null);
  const [leader, setLeader] = useState<{ top: number; left: number; width: number } | null>(null);
  const [tick, setTick] = useState(0);
  // B shows the findings in the order they appear on the page by default; the
  // reader can switch back to worst first.
  const [order, setOrder] = useState<'document' | 'worst'>('document');
  const shownList = order === 'document' ? read.inDocumentOrder : read.listed;
  const positions = useMemo(
    () => new Map(read.inDocumentOrder.map((f, i) => [f.rank, i + 1])),
    [read.inDocumentOrder],
  );
  const labelFor = (rank: number) => (order === 'document' ? (positions.get(rank) ?? rank) : rank);

  function pick(rank: number) {
    setFocusRank(rank);
    // Measure only after the list item and the page have re-rendered for the
    // new focus, or the target moves after the scroll has been worked out.
    // Scroll so the finding's first line sits level with the list item.
    function align(behavior: ScrollBehavior) {
      const item = items.current.get(rank);
      const target = read.nodes.current.get(rank);
      if (!item || !target) return;
      const delta = target.getBoundingClientRect().top - item.getBoundingClientRect().top;
      if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior });
      setTick((t) => t + 1);
    }
    setTimeout(() => align('smooth'), 60);
    // The previous flag's comment folds shut over 280ms and moves everything
    // below it, so check again once the fold and the scroll have finished.
    setTimeout(() => align('smooth'), 700);
  }

  // Keep the leader drawn between the picked item and its sentence.
  const shown = hoverRank ?? focusRank;
  useLayoutEffect(() => {
    function draw() {
      const item = shown === null ? undefined : items.current.get(shown);
      const target = shown === null ? undefined : read.nodes.current.get(shown);
      if (!item || !target) return setLeader(null);
      const a = item.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight) return setLeader(null);
      // From the item's first line, which is the line the finding is level with.
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
  }, [shown, read.nodes, tick]);

  return (
    <section className="review proto-follow proto-lineup" aria-label="What Redline found">
      <Summary />
      <div className="rank-index">
        <div className="proto-sticky">
          <p className="rank-index-caption" id="proto-index-caption">
            What Redline found
          </p>
          <div className="stance-switch proto-order" role="group" aria-label="Order">
            <button
              type="button"
              className="stance-option"
              aria-pressed={order === 'document'}
              onClick={() => setOrder('document')}
            >
              In the document
            </button>
            <button
              type="button"
              className="stance-option"
              aria-pressed={order === 'worst'}
              onClick={() => setOrder('worst')}
            >
              Worst first
            </button>
          </div>
          <IndexList
            listed={shownList}
            focusRank={focusRank}
            onPick={pick}
            onHover={setHoverRank}
            itemRefs={items}
            labelFor={labelFor}
            showBand={order === 'document'}
          />
        </div>
      </div>
      {leader && (
        <div
          className="proto-leader"
          aria-hidden="true"
          style={{ top: leader.top, left: leader.left, width: leader.width }}
        />
      )}
      <Page
        read={read}
        focusRank={focusRank}
        hoverRank={hoverRank}
        onFocus={setFocusRank}
        onHover={setHoverRank}
        labelFor={labelFor}
      />
    </section>
  );
}

/* C: Step through ---------------------------------------------------------- */

function VariantC() {
  const read = useRead();
  const [position, setPosition] = useState(0);
  const [open, setOpen] = useState(false);
  const [hoverRank, setHoverRank] = useState<number | null>(null);
  const current = read.listed[position];
  const focusRank = current?.rank ?? null;

  function goTo(index: number) {
    const next = Math.max(0, Math.min(read.listed.length - 1, index));
    setPosition(next);
    setOpen(false);
    const rank = read.listed[next].rank;
    requestAnimationFrame(() => {
      const el = read.nodes.current.get(rank);
      if (!el) return;
      // Clear the site header and the pinned bar, then a little air.
      const top = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  }

  function focusFromPage(rank: number) {
    const index = read.listed.findIndex((f) => f.rank === rank);
    if (index >= 0) setPosition(index);
  }

  return (
    <section className="review proto-step" aria-label="What Redline found">
      <Summary />
      <div className="proto-stepbar">
        <div className="proto-stepbar-row">
          <button
            type="button"
            className="proto-step-arrow"
            onClick={() => goTo(position - 1)}
            disabled={position === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="proto-step-current"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="rank-slot">{current?.rank}</span>
            {current?.kind === 'gap' && <span className="proto-gap-tag">Gap</span>}
            <span className="rank-name">{current && findingName(current)}</span>
            <span className="rank-aside">
              {position + 1} of {read.listed.length}
            </span>
          </button>
          <button
            type="button"
            className="proto-step-arrow"
            onClick={() => goTo(position + 1)}
            disabled={position === read.listed.length - 1}
          >
            Next
          </button>
        </div>
        {open && (
          <div className="rank-index proto-step-list">
            <p className="rank-index-caption" id="proto-index-caption">
              What Redline found, worst first
            </p>
            <IndexList
              listed={read.listed}
              focusRank={focusRank}
              onPick={(rank) => goTo(read.listed.findIndex((f) => f.rank === rank))}
              onHover={setHoverRank}
            />
          </div>
        )}
      </div>
      <Page
        read={read}
        focusRank={focusRank}
        hoverRank={hoverRank}
        onFocus={focusFromPage}
        onHover={setHoverRank}
      />
    </section>
  );
}

export function FlagSyncPrototype() {
  const params = useSearchParams();
  const variant = params.get('variant') ?? 'A';
  return (
    <>
      {variant === 'A' && <VariantA />}
      {variant === 'B' && <VariantB />}
      {variant === 'C' && <VariantC />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}
