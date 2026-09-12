'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { markUpDocument, textLines } from '@/lib/analysis/marked-document';
import type { Flag } from '@/lib/analysis/types';

const FOLD_MS = 280;

/**
 * The reader's document with its flags marked on it: the ranked list beside the
 * page, the source sentence highlighted in place, and the reading folded open
 * under the sentence it came from. One flag holds the crimson at a time.
 */
export function DocumentReview({
  name,
  text,
  flags,
}: {
  name: string;
  text: string;
  flags: Flag[];
}) {
  const { pieces, marked } = useMemo(() => markUpDocument(text, flags), [text, flags]);

  const [focusRank, setFocusRank] = useState<number | null>(
    marked.length > 0 ? 1 : null,
  );
  const focusRef = useRef<HTMLDivElement | null>(null);
  const readerMoved = useRef(false);

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
        The clauses that could cost you
      </h2>

      {marked.length > 0 && (
        <div className="rank-index">
          <p className="rank-index-caption" id="flag-index-caption">
            Flags in this agreement, worst first
          </p>
          <ol aria-labelledby="flag-index-caption">
            {marked.map(({ flag, rank }) => (
              <li key={flag.id}>
                <button
                  type="button"
                  aria-pressed={rank === focusRank}
                  onClick={() => focus(rank)}
                >
                  <span className="rank-slot">{rank}</span>
                  {flag.clauseType}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <article className="page" aria-label={`${name}, with its flags`}>
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
              ref={isFocus ? focusRef : undefined}
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

        {marked.length === 0 && (
          <div className="page-foot">
            <aside className="gap-note" aria-label="What Redline found">
              <p className="gap-statement">No flags on this one.</p>
              <p className="gap-explain">
                Redline marks the clauses that let the other side change what you
                are owed after you have signed. This agreement has none of them.
              </p>
            </aside>
          </div>
        )}
      </article>
    </section>
  );
}
