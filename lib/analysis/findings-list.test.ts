import { describe, expect, it } from 'vitest';
import { layOutReview } from './findings-list';
import type { GapClaim } from './gap';
import type { Flag } from './verified-flag';

// Three clauses, written so their order on the page is not their order by
// severity: the worst one is in the middle.
const FEES = 'Fees may rise at any time on notice.';
const SCOPE = 'The client may add work to the scope without extra pay.';
const TERM = 'This agreement renews each year unless cancelled in writing.';
const text = `Intro.\n${FEES}\nMiddle.\n${SCOPE}\nMore.\n${TERM}\nEnd.`;

function flag(id: string, sourceSentence: string, severity: number): Flag {
  return {
    id,
    clauseType: id,
    sourceSentence,
    severity,
    band: severity >= 65 ? 'high' : severity >= 35 ? 'medium' : 'low',
    explanation: '',
    textualAmbiguity: false,
    harmConfidence: 'full',
  };
}

function gap(id: string, severity: number): GapClaim {
  return {
    id,
    severity,
    band: severity >= 65 ? 'high' : severity >= 35 ? 'medium' : 'low',
    statement: `This agreement contains no ${id} term.`,
    explanation: '',
  };
}

const fees = flag('fees', FEES, 50);
const scope = flag('scope', SCOPE, 90);
const term = flag('term', TERM, 25);

function listed(order: 'document' | 'worst', gaps: GapClaim[] = []) {
  return layOutReview(text, [fees, scope, term], gaps, order).entries.map((entry) => ({
    id: entry.finding.id,
    number: entry.number,
    showBand: entry.showBand,
  }));
}

describe('the findings list in document order', () => {
  it('lists the flags in the order their source sentences appear, numbered by place', () => {
    expect(listed('document')).toEqual([
      { id: 'fees', number: 1, showBand: true },
      { id: 'scope', number: 2, showBand: true },
      { id: 'term', number: 3, showBand: true },
    ]);
  });
});

describe('gaps in the findings list', () => {
  const lateFee = gap('late-payment', 80);
  const revisions = gap('revisions', 40);

  it('come after every flag in document order, even a High gap after a Low flag, with no band', () => {
    expect(listed('document', [revisions, lateFee])).toEqual([
      { id: 'fees', number: 1, showBand: true },
      { id: 'scope', number: 2, showBand: true },
      { id: 'term', number: 3, showBand: true },
      { id: 'late-payment', number: 4, showBand: false },
      { id: 'revisions', number: 5, showBand: false },
    ]);
  });

  it('sit among the flags by severity worst first', () => {
    expect(listed('worst', [revisions, lateFee])).toEqual([
      { id: 'scope', number: 1, showBand: false },
      { id: 'late-payment', number: 2, showBand: false },
      { id: 'fees', number: 3, showBand: false },
      { id: 'revisions', number: 4, showBand: false },
      { id: 'term', number: 5, showBand: false },
    ]);
  });
});

describe('the numbers on the page', () => {
  function marks(order: 'document' | 'worst') {
    const layout = layOutReview(text, [fees, scope, term], [gap('late-payment', 80)], order);
    return {
      page: layout.pieces.flatMap((piece) =>
        piece.kind === 'flag' ? [[piece.marked.flag.id, layout.numberOf(piece.marked.rank)]] : [],
      ),
      gap: layout.numberOf(layout.entries.find((e) => e.finding.kind === 'gap')!.finding.rank),
    };
  }

  it('run down the page in document order, with the gap after them', () => {
    expect(marks('document')).toEqual({
      page: [['fees', 1], ['scope', 2], ['term', 3]],
      gap: 4,
    });
  });

  it('are the ranks worst first', () => {
    expect(marks('worst')).toEqual({
      page: [['fees', 3], ['scope', 1], ['term', 4]],
      gap: 2,
    });
  });
});

describe('what is never listed', () => {
  const nowhere = flag('nowhere', 'A sentence that is not in this agreement.', 95);

  it.each(['document', 'worst'] as const)('leaves out a flag the page cannot place (%s)', (order) => {
    const layout = layOutReview(text, [fees, nowhere, term], [], order);

    expect(layout.entries.map((entry) => entry.finding.id)).not.toContain('nowhere');
    expect(layout.pieces.some((p) => p.kind === 'flag' && p.marked.flag.id === 'nowhere')).toBe(false);
  });
});

describe('short lists', () => {
  it('lists nothing for a clean read', () => {
    const layout = layOutReview(text, [], [], 'document');

    expect(layout.entries).toEqual([]);
    expect(layout.gaps).toEqual([]);
    expect(layout.pieces.map((piece) => piece.text).join('')).toBe(text);
  });

  it('numbers gaps from 1 when there are no flags', () => {
    const layout = layOutReview(text, [], [gap('revisions', 40), gap('late-payment', 80)], 'document');

    expect(layout.entries.map((e) => [e.finding.id, e.number])).toEqual([
      ['late-payment', 1],
      ['revisions', 2],
    ]);
    expect(layout.gaps).toEqual(layout.entries);
  });

  it('gives the same list for the same read every time', () => {
    const once = listed('document', [gap('revisions', 40)]);
    const again = listed('document', [gap('revisions', 40)]);

    expect(again).toEqual(once);
  });
});

describe('the findings list worst first', () => {
  it('lists the flags by severity, numbered by rank, with no band', () => {
    expect(listed('worst')).toEqual([
      { id: 'scope', number: 1, showBand: false },
      { id: 'fees', number: 2, showBand: false },
      { id: 'term', number: 3, showBand: false },
    ]);
  });
});
