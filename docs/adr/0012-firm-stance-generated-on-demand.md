# Firm counter-offer stance is generated on-demand

Status: accepted

Only the soft counter-offer is drafted at analysis time (ADR-0009's default). The firm
version for a given flag is generated the moment the reader switches that flag to firm,
not before.

## Why

Most flags are expected to stay at the soft default. Pre-generating firm for every flag
pays a model call for a version most readers will never see; generating on-demand trades
a short wait at the moment of switching for not paying that cost speculatively.

## Consequences

- Switching a flag to firm has visible latency — a generation call, not a UI-only
  toggle. Needs a loading state.
- Once generated, a flag's firm version should be cached rather than regenerated on
  every later view or switch-back — an implementation detail, named here so it isn't
  accidentally rebuilt each time.
