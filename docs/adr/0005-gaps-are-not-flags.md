# Gaps are a separate output type from flags

Status: accepted

Redline reports two kinds of finding. A **flag** is a clause in the document that could
harm the reader, and it always shows its source sentence. A **gap** is a term the
agreement does not contain but should. Gaps are never presented as flags and never
claim a citation.

## Why this needs recording

The strongest freelancer evidence in `research/summary.md` is about absent terms, not
present ones — "I didn't have a clause on late payment in my contract and I wish I did,"
and scope creep that happened because deliverables were never written down. A product
that only reads what is there cannot speak to its own best evidence.

But ADR-0001 requires every flag to cite the exact sentence it came from, and treats an
uncitable flag as a bug. An absent clause has no sentence to cite. Rather than weaken
that rule — which is the whole basis for trusting the output — gaps get their own type
with their own standard of proof: a gap is checkable against the entire document
("this agreement contains no late-payment term"), which is a different and weaker claim
than pointing at a sentence, and is labelled as such.

## Consequences

- **Severity ranks both.** A high-severity gap can outrank a low-severity flag and appear above it in the same list. Severity governs order; type governs what the item is allowed to claim. The two are independent, and prominence never converts a gap into a flag.
- Two output types to design, explain, and test instead of one.
- Gap detection cannot be verified the way flags can. The flag test — every quote is findable in the source — has no equivalent here, so gaps need their own evaluation approach and are the more likely source of a wrong answer.
