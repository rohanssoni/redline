# Gaps get no drafted remedy in v1

Status: accepted

A gap is reported as a flagged omission only. Redline does not draft filler clause
language to fill it, even for a high-severity gap.

## Alternatives

- **Draft simple filler language for high-severity gaps.** This would have directly
  addressed the single best-evidenced freelancer pain point in the research (no
  late-payment clause). Rejected because it crosses a line ADR-0002 already drew: a
  counter-offer rewrites language that exists in the document, which is still reading;
  drafting language to fill an absence has no anchor at all, which is generation —
  explicitly deferred until the reading product finds fit.

## Why

A drafted gap-filler would be the least grounded thing Redline could produce — not just
uncited, which a gap already is (ADR-0005), but invented from nothing rather than
rewritten from something real. Holding this line keeps generation out of v1 entirely,
rather than letting it back in through counter-offers for gaps specifically.

## Consequences

- The best-evidenced freelancer pain in the research (absent late-payment terms) is
  flagged but not resolved by v1 — the reader knows the gap exists and has to write
  their own fix or raise it with the client unaided. Revisit this ADR alongside
  ADR-0002's deferred generation decision, not independently.
- The question box (capability 4) may still be asked "what should I put in this clause
  instead" — that is a generation question and gets the same decline treatment as a
  remedy question (ADR-0003), not an improvised answer.
