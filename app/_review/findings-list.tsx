'use client';

import type { ReactNode } from 'react';
import type { FindingsOrder, ListEntry } from '@/lib/analysis/findings-list';
import type { Finding } from '@/lib/analysis/ranking';
import type { Leader } from './use-line-up';

const BAND_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const;

/**
 * The findings list both review screens show beside the page (ADR-0024): the
 * order switch, then one entry per finding. In document order each flag carries
 * its severity band, because its number is now a place on the page and no longer
 * says how bad it is. A gap carries a "Gap" label in both orders, so the reader
 * knows before picking it that there is no sentence to show, and its statement
 * is held to two lines so a long one does not push the flags below it away.
 */
export function FindingsList({
  captionId,
  entries,
  order,
  onOrder,
  focusRank,
  onPick,
  onHover,
  entryRef,
  aside,
  quiet,
}: {
  captionId: string;
  entries: ListEntry[];
  order: FindingsOrder;
  onOrder: (order: FindingsOrder) => void;
  focusRank: number | null;
  onPick: (rank: number) => void;
  onHover: (rank: number | null) => void;
  entryRef: (rank: number) => (el: HTMLElement | null) => void;
  /** Anything a screen adds after an entry's name, such as "set aside". */
  aside?: (finding: Finding) => ReactNode;
  /** Whether an entry's name is shown quietly, such as a flag set aside. */
  quiet?: (finding: Finding) => boolean;
}) {
  return (
    <div className="rank-index">
      <div className="rank-index-sticky">
        <p className="rank-index-caption" id={captionId}>
          What Redline found
        </p>
        <div className="stance-switch rank-order" role="group" aria-label="List order">
          <button
            type="button"
            className="stance-option"
            aria-pressed={order === 'document'}
            onClick={() => onOrder('document')}
          >
            In the document
          </button>
          <button
            type="button"
            className="stance-option"
            aria-pressed={order === 'worst'}
            onClick={() => onOrder('worst')}
          >
            Worst first
          </button>
        </div>
        <ol aria-labelledby={captionId}>
          {entries.map(({ finding, number, showBand }) => (
            <li key={`${finding.kind}-${finding.id}`}>
              <button
                type="button"
                ref={entryRef(finding.rank)}
                aria-pressed={finding.rank === focusRank}
                data-kind={finding.kind}
                title={finding.kind === 'gap' ? finding.gap.statement : undefined}
                onClick={() => onPick(finding.rank)}
                onMouseEnter={() => onHover(finding.rank)}
                onMouseLeave={() => onHover(null)}
              >
                <span className="rank-slot">{number}</span>
                <span className="rank-text">
                  {finding.kind === 'gap' && <span className="rank-tag">Gap</span>}
                  {finding.kind === 'flag' && showBand && (
                    <span className="rank-tag" data-band={finding.flag.band}>
                      {BAND_LABEL[finding.flag.band]}
                    </span>
                  )}
                  <span className="rank-name" data-quiet={quiet?.(finding) ?? false}>
                    {finding.kind === 'flag' ? finding.flag.clauseType : finding.gap.statement}
                  </span>
                </span>
                {aside?.(finding)}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** The dotted line between a picked or hovered entry and its place on the page. */
export function LineUpLeader({ leader }: { leader: Leader | null }) {
  if (!leader) return null;
  return (
    <div
      className="line-up-leader"
      aria-hidden="true"
      style={{ top: leader.top, left: leader.left, width: leader.width }}
    />
  );
}
