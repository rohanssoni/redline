'use client';

import { useMemo, useState } from 'react';
import { markUpDocument, textLines } from '@/lib/analysis/marked-document';
import { rankFindings } from '@/lib/analysis/ranking';
import type { CleanRead, Gap, VerifiedFlag } from '@/lib/analysis/types';

/**
 * What a visitor without an account is shown: the summary, then their own
 * agreement with each flag under the sentence it came from, and the gaps at the
 * foot where there is no sentence to point at (ADR-0005).
 *
 * The same markup and the same ranking as the signed-in review, and none of the
 * parts that need somewhere to write: no set-aside control, no counter-offer,
 * no question box. Those are not hidden here, they are absent — nothing on this
 * page has an id to write against, because the document was never saved.
 */
export function TryReview({
  name,
  text,
  summary,
  flags,
  gaps,
  cleanRead,
}: {
  name: string;
  text: string;
  summary: string;
  flags: VerifiedFlag[];
  gaps: Gap[];
  cleanRead: CleanRead | null;
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

  // A flag Redline could not place on the page is not offered in the list
  // either, so the reader is never given a number with nothing behind it.
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

  return (
    <section className="review" aria-labelledby="try-result-heading">
      <h2 id="try-result-heading" className="visually-hidden">
        What Redline found in {name}
      </h2>

      <div className="try-summary">
        <p className="try-summary-label">What this agreement says</p>
        <p className="try-summary-body">{summary}</p>
      </div>

      {cleanRead !== null && (
        <div className="try-clean">
          <p className="try-clean-label">Clean read</p>
          <p className="try-clean-heading">This one reads like a normal agreement</p>
          <p className="try-clean-body">
            Nothing in it lets the other side change what you earn, owe, own or
            have to do once you have signed.
          </p>
          <p className="try-clean-body">
            Redline also looked for the terms agreements like this leave out: a
            deadline for payment, a ceiling on what you can be made to pay, a
            limit on revisions, a way to end it. None of them is missing.
          </p>
          <p className="try-clean-body">Your agreement is below.</p>
        </div>
      )}

      {listed.length > 0 && (
        <div className="rank-index">
          <p className="rank-index-caption" id="try-index-caption">
            What Redline found, worst first
          </p>
          <ol aria-labelledby="try-index-caption">
            {listed.map((finding) => (
              <li key={`${finding.kind}-${finding.id}`}>
                <button
                  type="button"
                  aria-pressed={finding.rank === focusRank}
                  onClick={() => setFocusRank(finding.rank)}
                >
                  <span className="rank-slot">{finding.rank}</span>
                  <span className="rank-name">
                    {finding.kind === 'flag'
                      ? finding.flag.clauseType
                      : finding.gap.statement}
                  </span>
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
            <div key={flag.id} className="flagged" data-focus={isFocus}>
              <button
                type="button"
                className="gutter-rank"
                aria-pressed={isFocus}
                aria-label={`Flag ${rank}: ${flag.clauseType}`}
                onClick={() => setFocusRank(rank)}
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
                    {/* Only where the sentence itself reads two ways, and always
                        beside that sentence, because rereading it is how the
                        reader checks the hedge (ADR-0010). */}
                    {flag.ambiguity && (
                      <p className="comment-hedge">{flag.ambiguity.hedge}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {(flags.length === 0 || rankedGaps.length > 0) && cleanRead === null && (
          <div className="page-foot">
            {flags.length === 0 && (
              <aside className="gap-note" aria-label="What Redline found">
                <p className="gap-statement">No flags on this one.</p>
                <p className="gap-explain">
                  Redline marks the clauses that let the other side change what
                  you are owed after you have signed. This agreement has none of
                  them.
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
                {rankedGaps.map(({ gap, rank }) => (
                  <aside
                    key={gap.id}
                    className="gap-note"
                    data-focus={rank === focusRank}
                    aria-label={`Gap ${rank}: ${gap.statement}`}
                  >
                    <p className="gap-statement">
                      <span className="gap-rank">{rank}</span>
                      {gap.statement}
                    </p>
                    <p className="gap-explain">{gap.explanation}</p>
                  </aside>
                ))}
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
