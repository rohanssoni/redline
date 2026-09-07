# Zero-flag drift compares to a fixed baseline until enough data exists, then switches to a rolling window

Status: accepted

The zero-flag rate (ADR-0008) is compared against the fixed 20% baseline (ADR-0011)
until a switchover point, then compared against a rolling window instead. The
switchover fires at whichever comes first: a document-count threshold or a fixed time
period since launch.

## Why

A fixed comparison protects the fragile early period, when too few documents exist for
a rolling average to mean anything and every document matters — a slow-adopting rolling
window could quietly re-baseline around a bad launch cohort instead of catching it.
Triggering on whichever threshold comes first means a fast-adopting product isn't stuck
on the placeholder longer than necessary, and a slow-adopting one still switches once
enough calendar time has passed to be confident sparse volume isn't itself the anomaly.

## Consequences

- Neither actual threshold — the document count or the time period — is set here; both
  need an analytics/product decision before this can run in production.
- Two comparison logics (fixed vs. rolling) have to be built and swapped, not just one —
  a small amount of extra implementation surface for a monitoring feature.
