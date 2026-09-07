# Counter-offer stance is chosen per flag, not fixed by the product

Status: accepted

Each flagged clause's counter-offer is drafted in one of two stances — soft or firm —
chosen by the reader for that specific flag. Redline defaults every counter-offer to
soft and lets the reader switch an individual flag to firm.

## Alternatives

- **Always draft the softest effective ask.** The recommendation on the table: a
  freelancer usually needs the client more than the reverse, so a uniformly soft ask
  maximizes the chance it actually gets sent. Rejected as a product-wide default because
  leverage isn't uniform — the same freelancer can have real standing on one clause
  (they're the only vendor who can do the work) and none on another (a boilerplate IP
  clause from a client they can't afford to lose). A single fixed tone gets one of those
  wrong every time.
- **Ask the reader to declare their stance up front, before drafting anything.**
  Rejected in favor of a default: forcing an explicit choice before any output adds
  friction for the common case, and most readers won't know their leverage in the
  abstract — they recognize it clause by clause, once they see what's actually being
  asked of them.

## Why

Leverage is a property of the relationship on that specific point, not a global trait of
the freelancer or the client. Defaulting to soft keeps the safe assumption (low
leverage) as the path of least resistance, while a per-flag override lets a reader who
knows they have standing on one clause use it, without that choice bleeding into every
other flag in the same document.

## Consequences

- The "counter-offer sent" success metric still applies, but should be tracked alongside
  which stance was sent — a soft ask sent and a firm ask sent are different signals
  about whether the product is calibrating leverage correctly.
- Two drafted versions per flag (or one drafted lazily on stance switch) — a build-time
  decision, not made here.
- Needs a glossary term, since it's now a concept the PRD and UI both reference
  precisely — added to `CONTEXT.md` as **Stance**.
