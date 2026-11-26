'use client';

import { useMemo, useState } from 'react';
import { layOutReview, type FindingsOrder } from '@/lib/analysis/findings-list';
import { textLines } from '@/lib/analysis/marked-document';
import { FindingsList, LineUpLeader } from '../_review/findings-list';
import { useLineUp } from '../_review/use-line-up';
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
  const [order, setOrder] = useState<FindingsOrder>('document');
  const layout = useMemo(() => layOutReview(text, flags, gaps, order), [text, flags, gaps, order]);
  const { pieces, entries, numberOf } = layout;
  const gapEntries = layout.gaps;
  const onThePage = pieces.some((piece) => piece.kind === 'flag');

  // The first entry in document order is picked when the review opens, so the
  // opening state matches the opening order.
  const lineUp = useLineUp(entries.length > 0 ? entries[0].finding.rank : null);
  const { focusRank, hoverRank } = lineUp;

  return (
    <section className="review review-lineup" aria-labelledby="try-result-heading">
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

      {entries.length > 0 && (
        <FindingsList
          captionId="try-index-caption"
          entries={entries}
          order={order}
          onOrder={setOrder}
          focusRank={focusRank}
          onPick={lineUp.pick}
          onHover={lineUp.setHoverRank}
          entryRef={lineUp.entryRef}
        />
      )}
      <LineUpLeader leader={lineUp.leader} />

      <article className="page" aria-label={`${name}, marked up`}>
        <p className="page-band">
          {!onThePage
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
              ref={lineUp.targetRef(rank)}
              className="flagged"
              data-focus={isFocus}
              data-hover={rank === hoverRank && !isFocus}
              onMouseEnter={() => lineUp.setHoverRank(rank)}
              onMouseLeave={() => lineUp.setHoverRank(null)}
            >
              <button
                type="button"
                className="gutter-rank"
                aria-pressed={isFocus}
                aria-label={`Flag ${numberOf(rank)}: ${flag.clauseType}`}
                onClick={() => lineUp.focusFromPage(rank)}
              >
                {numberOf(rank)}
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

        {(flags.length === 0 || gapEntries.length > 0) && cleanRead === null && (
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

            {gapEntries.length > 0 && (
              <div className="gap-notes">
                <p className="gap-caption">
                  {gapEntries.length === 1
                    ? 'One gap: a term this agreement leaves out. There’s no sentence to quote, because it isn’t in the document.'
                    : `${gapEntries.length} gaps: terms this agreement leaves out. There are no sentences to quote, because they aren’t in the document.`}
                </p>
                {gapEntries.map(({ finding, number }) => (
                  <aside
                    key={finding.id}
                    ref={lineUp.targetRef(finding.rank)}
                    className="gap-note"
                    data-focus={finding.rank === focusRank}
                    data-hover={finding.rank === hoverRank && finding.rank !== focusRank}
                    onMouseEnter={() => lineUp.setHoverRank(finding.rank)}
                    onMouseLeave={() => lineUp.setHoverRank(null)}
                    aria-label={`Gap ${number}: ${finding.gap.statement}`}
                  >
                    <p className="gap-statement">
                      <span className="gap-rank">{number}</span>
                      {finding.gap.statement}
                    </p>
                    <p className="gap-explain">{finding.gap.explanation}</p>
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
