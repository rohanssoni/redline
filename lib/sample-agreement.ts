// Synthetic agreement written for the landing page's demonstration. It is not from a
// real client, and the page labels it as a sample. The authored flags below are held
// to ADR-0001 like real output: every source sentence must appear verbatim in the
// agreement text, which sample-agreement.test.ts checks.

export type SampleClause = {
  heading: string;
  sentences: string[];
};

export type SampleFlag = {
  rank: number;
  label: string;
  sourceSentence: string;
  reading: string;
  hedged: boolean;
};

export type SampleGap = {
  statement: string;
};

export const sampleTitle = "Freelance Services Agreement";

export const sampleClauses: SampleClause[] = [
  {
    heading: "1. Services",
    sentences: [
      'The Contractor will provide the design services described in Schedule A (the "Services").',
      "The Client may change the scope of the Services at any time by written notice, and the Contractor will perform the Services as changed.",
    ],
  },
  {
    heading: "2. Fees and payment",
    sentences: [
      "The Client will pay the Contractor the fixed fee stated in Schedule A.",
      "The Contractor will invoice the Client on completion of each milestone.",
      "The Client will pay each undisputed invoice within ninety (90) days of receipt.",
    ],
  },
  {
    heading: "3. Revisions",
    sentences: [
      "The Contractor will make any revisions to the Deliverables that the Client requests, at no additional charge.",
    ],
  },
  {
    heading: "4. Intellectual property",
    sentences: [
      "On payment in full, the Contractor assigns to the Client all rights in the Deliverables.",
      "The Contractor also assigns to the Client all rights in any other work, ideas, or materials the Contractor creates during the term of this Agreement, whether or not they relate to the Services.",
    ],
  },
  {
    heading: "5. Termination",
    sentences: [
      "Either party may terminate this Agreement for material breach on thirty (30) days' written notice.",
      "The Client may also terminate this Agreement at any time, for any reason, and will owe the Contractor only for Deliverables accepted before the termination date.",
    ],
  },
  {
    heading: "6. Other clients",
    sentences: [
      "During the term of this Agreement and for a reasonable period afterwards, the Contractor will not provide similar services to any competitor of the Client.",
    ],
  },
  {
    heading: "7. General",
    sentences: [
      "This Agreement is governed by the laws of the State of Delaware.",
      "Notices under this Agreement must be sent by post to the addresses above.",
    ],
  },
];

export const sampleText = sampleClauses
  .map((clause) => [clause.heading, ...clause.sentences].join("\n"))
  .join("\n\n");

// Ranked by what each clause costs the reader if it fires (ADR-0004). The governing-law
// and breach clauses are unusual or symmetric, so they are not flagged at all.
export const sampleFlags: SampleFlag[] = [
  {
    rank: 1,
    label: "Rights to all your work",
    sourceSentence:
      "The Contractor also assigns to the Client all rights in any other work, ideas, or materials the Contractor creates during the term of this Agreement, whether or not they relate to the Services.",
    reading:
      "The client gets the rights to everything you make while this agreement runs, including work for other clients and your own projects.",
    hedged: false,
  },
  {
    rank: 2,
    label: "Limits on other clients",
    sourceSentence:
      "During the term of this Agreement and for a reasonable period afterwards, the Contractor will not provide similar services to any competitor of the Client.",
    reading:
      "This could stop you taking similar work from other clients after the agreement ends. It doesn't say how long a reasonable period is, or who counts as a competitor.",
    hedged: true,
  },
  {
    rank: 3,
    label: "No pay if they end it early",
    sourceSentence:
      "The Client may also terminate this Agreement at any time, for any reason, and will owe the Contractor only for Deliverables accepted before the termination date.",
    reading:
      "The client can end the agreement whenever they like and pay nothing for work you've started but they haven't accepted.",
    hedged: false,
  },
  {
    rank: 4,
    label: "Scope grows, fee doesn't",
    sourceSentence:
      "The Client may change the scope of the Services at any time by written notice, and the Contractor will perform the Services as changed.",
    reading:
      "The client can add work by sending a notice, and nothing here raises the fixed fee when they do.",
    hedged: false,
  },
  {
    rank: 5,
    label: "Unpaid, unlimited revisions",
    sourceSentence:
      "The Contractor will make any revisions to the Deliverables that the Client requests, at no additional charge.",
    reading: "There's no limit on revisions, and you aren't paid for any of them.",
    hedged: false,
  },
  {
    rank: 6,
    label: "Up to 90 days to pay",
    sourceSentence: "The Client will pay each undisputed invoice within ninety (90) days of receipt.",
    reading:
      "You can wait up to 90 days for each payment, and only invoices the client doesn't dispute have to be paid on that schedule.",
    hedged: false,
  },
];

export const sampleGaps: SampleGap[] = [
  {
    statement: "This agreement has no late-payment term.",
  },
];
