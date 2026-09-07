# A document with no flags is a result, not an empty state

Status: accepted

When a document produces no flags above the severity threshold, Redline shows a
dedicated "this reads as a normal agreement" result rather than an empty list. The
zero-flag rate across all analyses is tracked as a production health metric.

## Why

An empty list is ambiguous — did Redline find nothing, or did it fail silently? A
dedicated clean-read result removes that doubt for the reader. The metric matters
because nothing else in the product would surface a broken severity filter: if
ADR-0004's plausibility filter or ADR-0006's confidence threshold starts suppressing too
aggressively, the visible symptom is documents quietly coming back empty, and only a
tracked rate catches that before it erodes trust at scale.

## Consequences

- Needs designed copy, not just an empty-state fallback — it has to communicate
  confidence without hedging ("we didn't find anything, but check yourself anyway"),
  which would undercut the point of treating it as a first-class result.
- The zero-flag rate is meaningless without a baseline. Someone still has to decide what
  rate is expected before "too high" or "too low" means anything — not decided here.
