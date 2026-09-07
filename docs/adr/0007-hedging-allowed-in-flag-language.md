# Flags can hedge in language, not just in inclusion

Status: accepted

A flag's wording may use calibrated hedging — "this could allow," "this may be read
as" — when the model's confidence in its own interpretation is partial. Redline does not
require every visible flag to read as a flat, unqualified statement.

## Alternatives

- **Ban hedging outright; state plainly or omit.** The recommendation on the table:
  express uncertainty only by omission, so every visible flag reads as fact and stays
  checkable by construction. Rejected in favor of letting a flag carry its own
  confidence, rather than forcing a binary between full confidence and silence.

## Why

A flat statement and an omission both throw away information the reader could use — one
overstates certainty, the other hides a real, partially-confident finding entirely.
Calibrated hedging keeps borderline findings visible while being honest about how sure
Redline is.

## Consequences

- **This sits in tension with ADR-0001's checkability claim.** A hedged flag ("this
  could be read as...") is not falsifiable the same way a plain one is — the reader can
  verify the sentence exists, but not whether "could" was the right word. The source
  citation has to carry the verifiability weight here; the flag's own wording no longer
  guarantees it.
- Hedging vocabulary needs its own constraint before this ships, or it drifts into the
  vague, unverifiable language ADR-0001 was written against — e.g. bounding it to
  describe interpretation uncertainty only, never to imply a claim the source sentence
  doesn't support. That constraint is not defined yet and belongs in the PRD.
