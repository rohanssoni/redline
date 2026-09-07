# Red line matches are judged on intent, not wording

Status: accepted

A clause triggers the red-line always-flag override (ADR-0013) when the model judges it
violates the intent of a red line, even if the clause is phrased completely differently
from how the reader wrote the red line. Matching is not restricted to literal or
near-literal term overlap.

## Alternatives

- **Exact/literal match only.** Rejected: a client's contract almost never phrases a
  term the way a reader's red line does, so requiring literal overlap would make the
  override rarely fire and miss most of the violations it exists to catch.

## Why

Consistent with ADR-0006's recall-over-precision stance: the citation shown alongside a
red-line-triggered flag is the safety net if a semantic match turns out to be a stretch,
the same way it is for an ordinary borderline flag. Restricting to literal matching would
only protect against a failure mode — a bad match — that the citation already protects
against.

## Consequences

- Expect a wider range of clauses to trigger red-line flags than the reader might expect
  from the literal wording of their own list. The flag-dismissal split for red-line-
  triggered flags (ADR-0013) is how to detect if matching is running too loose.
- Matching quality now depends on the model's judgment of intent rather than exact
  string matching — harder to test, and needs its own evaluation approach before this
  ships, not decided here.
