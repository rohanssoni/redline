# Zero-flag baseline starts at 20%, held provisionally

Status: accepted

The zero-flag rate (ADR-0008) is compared against a starting baseline of 20% of
analyzed documents returning a clean read. This number is a provisional starting point
to watch for drift against, not a validated target, and is expected to be replaced once
real production data exists.

## Why

No number here can be validated before launch — there's no production corpus, and
`research/summary.md`'s own verdict is that pain and demand data are unvalidated for
this product. A named number, even a guess, gives the health metric something to be
measured against from day one, rather than waiting for enough data to derive one — the
alternative leaves the metric blind during the exact early period when a broken filter
is most likely to ship unnoticed.

## Consequences

- 20% is a placeholder, not a researched figure. It must be revisited once real
  documents have gone through the pipeline — supersede this ADR when that happens rather
  than editing the number in place.
- "Drift" needs an operational definition (a rolling window vs. a fixed comparison
  point) before this can actually page anyone — not decided here.
