"use client";

import { useEffect, useRef, useState } from "react";
import {
  sampleClauses,
  sampleFlags,
  sampleGaps,
  sampleTitle,
  type SampleFlag,
} from "@/lib/sample-agreement";

const FOLD_MS = 280;

const flagBySentence = new Map(sampleFlags.map((flag) => [flag.sourceSentence, flag]));

function flagsIn(sentences: string[]): SampleFlag[] {
  return sentences
    .map((sentence) => flagBySentence.get(sentence))
    .filter((flag): flag is SampleFlag => flag !== undefined)
    .sort((a, b) => a.rank - b.rank);
}

const clauses = sampleClauses.map((clause, index) => ({
  ...clause,
  bodyId: `sample-clause-${index + 1}`,
  flags: flagsIn(clause.sentences),
}));

export function SampleReview() {
  // null means the reader folded the focused clause away and no flag is in focus.
  const [focusRank, setFocusRank] = useState<number | null>(1);
  const [openedByReader, setOpenedByReader] = useState<ReadonlySet<string>>(() => new Set());
  const focusRef = useRef<HTMLDivElement | null>(null);
  const readerMoved = useRef(false);

  const isOpen = (clause: (typeof clauses)[number]) =>
    openedByReader.has(clause.heading) || clause.flags.some((flag) => flag.rank === focusRank);
  const everyClauseOpen = clauses.every(isOpen);

  // Clauses fold and unfold over FOLD_MS, so wait for the layout to settle before
  // deciding whether the focused sentence needs scrolling into view.
  useEffect(() => {
    if (!readerMoved.current) return;
    const timer = window.setTimeout(() => {
      const element = focusRef.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top;
      if (top < 72 || top > window.innerHeight * 0.6) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      }
    }, FOLD_MS);
    return () => window.clearTimeout(timer);
  }, [focusRank]);

  function focus(rank: number) {
    readerMoved.current = true;
    setFocusRank(rank);
  }

  function pressHeading(clause: (typeof clauses)[number]) {
    if (isOpen(clause)) {
      if (clause.flags.some((flag) => flag.rank === focusRank)) {
        readerMoved.current = false;
        setFocusRank(null);
      }
      setOpenedByReader((current) => {
        if (!current.has(clause.heading)) return current;
        const next = new Set(current);
        next.delete(clause.heading);
        return next;
      });
      return;
    }
    if (clause.flags.length > 0) {
      focus(clause.flags[0].rank);
    } else {
      setOpenedByReader((current) => new Set(current).add(clause.heading));
    }
  }

  function toggleWholeAgreement() {
    setOpenedByReader(everyClauseOpen ? new Set() : new Set(clauses.map((clause) => clause.heading)));
  }

  return (
    <section className="review" aria-labelledby="review-heading">
      <h2 id="review-heading" className="visually-hidden">
        A sample agreement, flagged
      </h2>

      <div className="rank-index">
        <p className="rank-index-caption" id="rank-index-caption">
          Flags in this sample, worst first
        </p>
        <ol aria-labelledby="rank-index-caption">
          {sampleFlags.map((flag) => (
            <li key={flag.rank}>
              <button
                type="button"
                aria-pressed={flag.rank === focusRank}
                onClick={() => focus(flag.rank)}
              >
                <span className="rank-slot">{flag.rank}</span>
                {flag.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <article className="page" aria-label="Sample agreement">
        <p className="sample-label">Sample agreement written for this page. It isn&apos;t from a real client.</p>
        <h3 className="doc-title">{sampleTitle}</h3>
        <p className="doc-parties">Between the Client and the Contractor</p>

        {clauses.map((clause) => {
          const open = isOpen(clause);
          const { flags } = clause;

          return (
            <section key={clause.heading} className="clause" data-open={open}>
              <h4 className="clause-heading">
                {flags.length > 0 && (
                  <span className="gutter-ranks" aria-hidden="true">
                    {flags.map((flag) => flag.rank).join(" ")}
                  </span>
                )}
                <button
                  type="button"
                  className="clause-toggle"
                  aria-expanded={open}
                  aria-controls={clause.bodyId}
                  onClick={() => pressHeading(clause)}
                >
                  {clause.heading}
                  <span className="clause-count">
                    {flags.length === 0 ? "no flags" : flags.length === 1 ? "1 flag" : `${flags.length} flags`}
                  </span>
                </button>
              </h4>

              <div className="clause-fold" id={clause.bodyId}>
                <div className="clause-body" inert={!open}>
                  <div className="clause-inner">
                    {clause.sentences.map((sentence) => {
                      const flag = flagBySentence.get(sentence);
                      if (!flag) {
                        return (
                          <p key={sentence} className="sentence">
                            {sentence}
                          </p>
                        );
                      }
                      const isFocus = flag.rank === focusRank;
                      return (
                        <div
                          key={sentence}
                          ref={isFocus ? focusRef : undefined}
                          className="flagged"
                          data-focus={isFocus}
                        >
                          <button
                            type="button"
                            className="gutter-rank"
                            aria-pressed={isFocus}
                            aria-label={`Flag ${flag.rank}: ${flag.label}`}
                            onClick={() => focus(flag.rank)}
                          >
                            {flag.rank}
                          </button>
                          <p className="sentence">
                            <mark>{sentence}</mark>
                          </p>
                          <div className="comment" inert={!isFocus}>
                            <div className="comment-body">
                              <div className="comment-leader" aria-hidden="true" />
                              <div className="comment-inner">
                                <p className="comment-reading">{flag.reading}</p>
                                {flag.hedged && (
                                  <p className="comment-hedge">
                                    It says &ldquo;could&rdquo; because this sentence can be read more than one way.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <div className="page-foot">
          {sampleGaps.map((gap) => (
            <aside key={gap.statement} className="gap-note" aria-label="Missing term">
              <p className="gap-statement">{gap.statement}</p>
              <p className="gap-explain">
                That&apos;s a gap, so there&apos;s no sentence to quote. The agreement doesn&apos;t
                contain one.
              </p>
            </aside>
          ))}
          <button
            type="button"
            className="page-toggle"
            aria-expanded={everyClauseOpen}
            onClick={toggleWholeAgreement}
          >
            {everyClauseOpen ? "Fold the agreement back" : "Show the whole agreement"}
          </button>
        </div>
      </article>
    </section>
  );
}
