'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { markUpDocument, textLines } from '@/lib/analysis/marked-document';
import { rankFindings } from '@/lib/analysis/ranking';
import type { Flag, GapClaim } from '@/lib/analysis/types';

const FOLD_MS = 280;

/**
 * The reader's document with what Redline found on it: one ranked list beside
 * the page holding flags and gaps together, each flag's source sentence
 * highlighted in place with its reading folded open underneath, and the gaps at
 * the page foot where there is no sentence to point at (ADR-0005).
 *
 * A gap is numbered in the same list as the flags because severity decides the
 * order for both. It never gets a change bar, a highlight or a leader, because
 * it has nothing on the page to mark, and the type it arrives as has no field a
 * sentence could be put in.
 */
export function DocumentReview({
  name,
  text,
  flags,
  gaps,
}: {
  name: string;
  text: string;
  flags: Flag[];
  gaps: GapClaim[];
}) {
  const findings = useMemo(() => rankFindings(flags, gaps), [flags, gaps]);

  const flagRanks = useMemo(
    () =>
      new Map(
        findings
          .filter((finding) => finding.kind === 'flag')
          .map((finding) => [finding.id, finding.rank]),
      ),
    [findings],
  );

  const { pieces, marked } = useMemo(
    () =>
      markUpDocument(text, flags, (flag, index) => flagRanks.get(flag.id) ?? index + 1),
    [text, flags, flagRanks],
  );

  // A flag Redline could not place on the page is not in the list either, so the
  // reader is never offered a number with nothing behind it.
  const onThePage = useMemo(
    () => new Set(marked.map((each) => each.flag.id)),
    [marked],
  );
  const listed = useMemo(
    () =>
      findings.filter(
        (finding) => finding.kind === 'gap' || onThePage.has(finding.id),
      ),
    [findings, onThePage],
  );
  const rankedGaps = useMemo(
    () => listed.filter((finding) => finding.kind === 'gap'),
    [listed],
  );

  const [focusRank, setFocusRank] = useState<number | null>(
    listed.length > 0 ? listed[0].rank : null,
  );
  const focusRef = useRef<HTMLElement | null>(null);
  const readerMoved = useRef(false);

  // A callback ref rather than the ref object, because the focused thing is a
  // flag's block on the page or a gap note at its foot, and both scroll the same.
  function keepFocused(node: HTMLElement | null) {
    focusRef.current = node;
  }

  // The comment folds open over FOLD_MS, so the page settles before it is
  // decided whether the sentence needs scrolling to.
  useEffect(() => {
    if (!readerMoved.current) return;
    const timer = window.setTimeout(() => {
      const element = focusRef.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top;
      if (top < 72 || top > window.innerHeight * 0.6) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        element.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      }
    }, FOLD_MS);
    return () => window.clearTimeout(timer);
  }, [focusRank]);

  function focus(rank: number) {
    readerMoved.current = true;
    setFocusRank(rank);
  }

  return (
    <section className="review doc-review" aria-labelledby="flags-heading">
      <h2 id="flags-heading" className="visually-hidden">
        What this agreement could cost you
      </h2>

      {listed.length > 0 && (
        <div className="rank-index">
          <p className="rank-index-caption" id="flag-index-caption">
            What Redline found, worst first
          </p>
          <ol aria-labelledby="flag-index-caption">
            {listed.map((finding) => (
              <li key={`${finding.kind}-${finding.id}`}>
                <button
                  type="button"
                  aria-pressed={finding.rank === focusRank}
                  onClick={() => focus(finding.rank)}
                >
                  <span className="rank-slot">{finding.rank}</span>
                  {finding.kind === 'flag'
                    ? finding.flag.clauseType
                    : finding.gap.statement}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <article className="page" aria-label={`${name}, marked up`}>
        <p className="page-band">
          {marked.length === 0
            ? 'Your document, as Redline read it'
            : 'Your document. Each flag sits under the sentence it came from.'}
        </p>

        {pieces.map((piece, index) => {
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
              ref={isFocus ? keepFocused : undefined}
              className="flagged"
              data-focus={isFocus}
            >
              <button
                type="button"
                className="gutter-rank"
                aria-pressed={isFocus}
                aria-label={`Flag ${rank}: ${flag.clauseType}`}
                onClick={() => focus(rank)}
              >
                {rank}
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

        {(marked.length === 0 || rankedGaps.length > 0) && (
          <div className="page-foot">
            {marked.length === 0 && (
              <aside className="gap-note" aria-label="What Redline found">
                <p className="gap-statement">No flags on this one.</p>
                <p className="gap-explain">
                  Redline marks the clauses that let the other side change what you
                  are owed after you have signed. This agreement has none of them.
                </p>
              </aside>
            )}

            {rankedGaps.length > 0 && (
              <div className="gap-notes">
                <p className="gap-caption">
                  {rankedGaps.length === 1
                    ? 'One gap: a term this agreement leaves out. There’s no sentence to quote, because it isn’t in the document.'
                    : `${rankedGaps.length} gaps: terms this agreement leaves out. There are no sentences to quote, because they aren’t in the document.`}
                </p>
                {rankedGaps.map(({ gap, rank }) => {
                  const isFocus = rank === focusRank;
                  return (
                    <aside
                      key={gap.id}
                      ref={isFocus ? keepFocused : undefined}
                      className="gap-note"
                      data-focus={isFocus}
                      aria-label={`Gap ${rank}: ${gap.statement}`}
                    >
                      <p className="gap-statement">
                        <span className="gap-rank">{rank}</span>
                        {gap.statement}
                      </p>
                      <p className="gap-explain">{gap.explanation}</p>
                    </aside>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
