'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { layOutReview, type FindingsOrder } from '@/lib/analysis/findings-list';
import { textLines } from '@/lib/analysis/marked-document';
import { FindingsList, LineUpLeader } from '../../../_review/findings-list';
import { useLineUp } from '../../../_review/use-line-up';
import type { CounterOfferClaim, Flag, GapClaim } from '@/lib/analysis/types';
import {
  bringFlagBackAction,
  recordCounterOfferCopyAction,
  requestFirmCounterOffer,
  setFlagAsideAction,
} from './actions';
import { CounterOfferNote, type FirmDraft } from './counter-offer-note';

/**
 * The reader's document with what Redline found on it: one ranked list beside
 * the page holding flags and gaps together, each flag's source sentence
 * highlighted in place with its reading folded open underneath, and the gaps at
 * the page foot where there is no sentence to point at (ADR-0005).
 *
 * The list opens in document order, with a Worst first switch, and picking an
 * entry lines it up with its place on the page (ADR-0024). A gap is numbered in
 * the same list as the flags. Its place is its note at the page foot, never a
 * sentence: it gets no highlight, because it has nothing on the page to mark,
 * and the type it arrives as has no field a sentence could be put in.
 *
 * A flag the reader has set aside stays exactly where it is: same place in the
 * list, same number, same sentence still marked on the page. It goes quiet
 * rather than going away. Two reasons, and the second is the one that settled
 * it:
 *
 * - A flag is anchored to a sentence of the reader's own document. Moving it to
 *   a drawer at the foot would cut it from the only thing that makes it
 *   checkable.
 * - Renumbering what is left would make the read look like a different read
 *   every time the reader dealt with a clause, and the numbers are how they
 *   keep their place in it.
 *
 * A gap has no set-aside control, here or anywhere. There is no prop for one
 * and nothing below renders one for the gap list.
 */
export function DocumentReview({
  documentId,
  name,
  text,
  flags,
  gaps,
  counterOffers,
  setAside = [],
}: {
  /** Which document a firm redraft is asked for against. */
  documentId: string;
  name: string;
  text: string;
  flags: Flag[];
  gaps: GapClaim[];
  /**
   * The drafts this document has: the soft one for each flag, and a firm one
   * for any flag a reader has already asked about (ADR-0012). Never one for a
   * gap.
   */
  counterOffers: CounterOfferClaim[];
  /**
   * The ids of the flags this reader has already set aside, as the store holds
   * them. Flag ids only: a gap cannot be set aside, so none can be in here.
   */
  setAside?: string[];
}) {
  // Seeded from the store and kept here while the reader works, so a flag moves
  // the moment they ask rather than after a round trip. A write that does not go
  // through puts it straight back, next to the reason it did not.
  const [quiet, setQuiet] = useState<ReadonlySet<string>>(
    () => new Set(setAside),
  );
  const [moving, setMoving] = useState<ReadonlySet<string>>(new Set());
  const [problems, setProblems] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );

  useEffect(() => {
    setQuiet(new Set(setAside));
    // `setAside` is a fresh array on every render of the page above, so the
    // join is what says whether the stored answer actually changed.
  }, [setAside.join('\u0000')]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = useCallback(
    async (flagId: string, away: boolean) => {
      setProblems((was) => without(was, flagId));
      setMoving((was) => withId(was, flagId));
      setQuiet((was) => (away ? withId(was, flagId) : withoutId(was, flagId)));

      const result = away
        ? await setFlagAsideAction(documentId, flagId)
        : await bringFlagBackAction(documentId, flagId);

      setMoving((was) => withoutId(was, flagId));
      if (result.error) {
        // Back where it was. The reader is told what happened rather than left
        // with a flag that looks dealt with and is not.
        setQuiet((was) => (away ? withoutId(was, flagId) : withId(was, flagId)));
        setProblems((was) => new Map(was).set(flagId, result.error as string));
      }
    },
    [documentId],
  );

  // Keyed by flag id, which is the only thing a counter-offer names. There is no
  // lookup here a gap could answer: the gaps are in their own list, under their
  // own ids, and nothing below asks this map about one (ADR-0014).
  const drafts = useMemo(
    () =>
      new Map(
        counterOffers
          .filter((counterOffer) => counterOffer.stance === 'soft')
          .map((counterOffer) => [counterOffer.flagId, counterOffer]),
      ),
    [counterOffers],
  );

  // A firm draft is here only for a flag some reader already switched, and it is
  // what keeps that switch free the second time (ADR-0012).
  const firmDrafts = useMemo(
    () =>
      new Map(
        counterOffers
          .filter((counterOffer) => counterOffer.stance === 'firm')
          .map((counterOffer) => [counterOffer.flagId, counterOffer]),
      ),
    [counterOffers],
  );

  /**
   * Asks for one flag's firm wording, and only when a reader has asked for it:
   * this is called from the stance switch inside that flag's note, never from a
   * render, an effect or a hover (ADR-0012). Nothing here loops over the flags.
   *
   * The action writes the draft into the document before it answers, so the map
   * above holds it on the next view and this is not called for that flag again.
   */
  const draftFirm = useCallback(
    (flagId: string): Promise<FirmDraft> =>
      requestFirmCounterOffer(documentId, flagId),
    [documentId],
  );

  /**
   * Counts one copy of one flag's counter-offer. Copying is as close as Redline
   * gets to watching a counter-offer be sent, so this is where the primary
   * success metric comes from — and it is recorded, and reported, as a copy.
   *
   * Nothing is awaited and nothing is shown. The wording is on the clipboard
   * before this is called, and the reader has no stake in whether the count
   * landed. The stance is passed so the server can find the stored draft; what
   * is written down is that draft's own stance, not this one.
   */
  const countCopy = useCallback(
    (flagId: string, stance: string) => {
      void recordCounterOfferCopyAction(documentId, flagId, stance);
    },
    [documentId],
  );

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
    <section className="review review-lineup doc-review" aria-labelledby="flags-heading">
      <h2 id="flags-heading" className="visually-hidden">
        What this agreement could cost you
      </h2>

      {entries.length > 0 && (
        <FindingsList
          captionId="flag-index-caption"
          entries={entries}
          order={order}
          onOrder={setOrder}
          focusRank={focusRank}
          onPick={lineUp.pick}
          onHover={lineUp.setHoverRank}
          entryRef={lineUp.entryRef}
          quiet={(finding) => finding.kind === 'flag' && quiet.has(finding.id)}
          aside={(finding) =>
            finding.kind === 'flag' && quiet.has(finding.id) ? (
              <span className="rank-aside">set aside</span>
            ) : null
          }
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
          const isQuiet = quiet.has(flag.id);
          const problem = problems.get(flag.id);
          return (
            <div
              key={flag.id}
              ref={lineUp.targetRef(rank)}
              className="flagged"
              data-focus={isFocus}
              data-hover={rank === hoverRank && !isFocus}
              data-quiet={isQuiet}
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
                    {isQuiet ? (
                      /* Set aside, and nothing more. The sentence above keeps
                         its mark, so the reader can still see what they dealt
                         with and put it back from the same spot. */
                      <div className="aside-note">
                        <p className="aside-state">
                          You set this one aside. The sentence stays marked.
                        </p>
                        <button
                          className="link-button"
                          type="button"
                          disabled={moving.has(flag.id)}
                          onClick={() => void move(flag.id, false)}
                        >
                          Bring it back
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="comment-reading">{flag.explanation}</p>
                        {/* The hedge sits under the reading, next to the sentence it
                            is about, because the reader checks it by rereading that
                            sentence (ADR-0010). A flag with no `ambiguity` on it is
                            plainly worded and gets nothing here. */}
                        {flag.ambiguity && (
                          <p className="comment-hedge">{flag.ambiguity.hedge}</p>
                        )}
                        {/* Under the reading, beside the sentence it replaces. A
                            flag whose draft came back about some other clause has
                            nothing here, and the flag itself is unchanged. */}
                        {drafts.has(flag.id) && (
                          <CounterOfferNote
                            soft={drafts.get(flag.id)!}
                            firm={firmDrafts.get(flag.id)}
                            onDraftFirm={() => draftFirm(flag.id)}
                            onCopied={(counterOffer) =>
                              countCopy(flag.id, counterOffer.stance)
                            }
                          />
                        )}
                        {/* Last in the comment, after the reading and the wording
                            to send back, because it is the thing a reader does
                            once they have made up their mind about the clause. */}
                        <div className="aside-action">
                          <button
                            className="link-button"
                            type="button"
                            disabled={moving.has(flag.id)}
                            onClick={() => void move(flag.id, true)}
                          >
                            Set this one aside
                          </button>
                        </div>
                      </>
                    )}
                    {problem && (
                      <p className="aside-state" data-tone="refused" role="alert">
                        {problem}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {(flags.length === 0 || gapEntries.length > 0) && (
          <div className="page-foot">
            {/* Says only what it can see: this document has no flags on it, and
                the gaps below are what is left. It never speaks for the whole
                read, because a document with nothing in it at all gets the clean
                read instead and never renders this component (ADR-0008). The
                test is `flags.length`, not `marked.length`: flags that exist but
                could not be placed on the page are still flags. */}
            {flags.length === 0 && (
              <aside className="gap-note" aria-label="What Redline found">
                <p className="gap-statement">No flags on this one.</p>
                <p className="gap-explain">
                  Redline marks the clauses that let the other side change what you
                  are owed after you have signed. This agreement has none of them.
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

function withId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return new Set(set).add(id);
}

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}

function without(
  map: ReadonlyMap<string, string>,
  id: string,
): ReadonlyMap<string, string> {
  const next = new Map(map);
  next.delete(id);
  return next;
}
