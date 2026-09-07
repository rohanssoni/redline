# V1 excludes consumer terms of service as input

Status: accepted

Redline v1 does not accept a consumer terms-of-service document as input, even though
`CLAUDE.md`'s opening description names "terms of service" as an example of what gets
uploaded. Only agreements a freelancer or independent contractor negotiates directly
with a client are in scope (ADR-0002).

## Alternatives

- **Allow ToS as input, without counter-offers.** Considered: a reader could still get
  a summary, flags, gaps, and question-box access for a ToS, with capability 3
  (counter-offer) simply not applicable since there's nothing to negotiate. Rejected
  because it reintroduces the exact use case `research/summary.md`'s verdict said has
  the worst product fit — no counter-offer target, and a free competitor (ToS;DR)
  already covers the major services — and blurs who v1 is actually for.

## Why

ADR-0002 already scopes the reader to freelancers negotiating with clients; a consumer
ToS is not that kind of document, regardless of what `CLAUDE.md`'s original one-line
pitch names as an example input. Narrowing this explicitly, rather than leaving it as an
inference from the segment decision, stops a future reader from building ToS support
just because the top-level product description still lists it.

## Consequences

- `CLAUDE.md`'s opening description ("a contract, lease, freelance agreement, or terms
  of service") is now broader than what v1 actually builds. That line describes the
  eventual product pitch, not the v1 boundary — this ADR is the authoritative scope
  statement until `CLAUDE.md` itself is revised.
- If v1 finds fit and the segment expands later (per ADR-0002's revisit condition),
  this ADR should be revisited alongside it, not independently.
