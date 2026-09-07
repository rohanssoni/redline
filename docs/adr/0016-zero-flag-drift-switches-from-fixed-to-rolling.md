# Zero-flag drift compares to a fixed baseline until enough data exists, then switches to a rolling window

Status: accepted

The zero-flag rate (ADR-0008) is compared against the fixed 20% baseline (ADR-0011)
until a switchover point, then compared against a rolling window instead. The
switchover fires at whichever comes first: **500 analyzed documents, or 90 days since
launch.**

## Why

A fixed comparison protects the fragile early period, when too few documents exist for
a rolling average to mean anything and every document matters — a slow-adopting rolling
window could quietly re-baseline around a bad launch cohort instead of catching it.
Triggering on whichever threshold comes first means a fast-adopting product isn't stuck
on the placeholder longer than necessary, and a slow-adopting one still switches once
enough calendar time has passed to be confident sparse volume isn't itself the anomaly.

## Consequences

- 500 documents gives a reasonably tight estimate of the zero-flag rate around a 20%
  baseline (roughly ±3.5 points at typical confidence levels); 90 days is one quarter,
  a natural review cadence. Both are chosen for statistical and operational
  reasonableness, not derived from Redline-specific data — revisit if actual document
  volume or variance looks different from this assumption once real data exists.
- Two comparison logics (fixed vs. rolling) have to be built and swapped, not just one —
  a small amount of extra implementation surface for a monitoring feature.
