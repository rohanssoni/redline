# Hedging is triggered only by ambiguity in the source sentence

Status: accepted

A flag hedges — "this could allow...", "this may be read as..." — only when the quoted
source sentence is itself genuinely open to more than one reading. Hedging is not used
for any other kind of uncertainty: not confidence in how a court would rule, not
uncertainty about real-world consequences, not a general low-confidence score unrelated
to the sentence's wording.

## Alternatives

- **Hedge on any source of low model confidence.** Rejected because the reader has no
  way to check a hedge that isn't about the sentence itself — it reopens exactly the
  unverifiable vagueness ADR-0001 was written to prevent. A hedge that isn't about
  textual ambiguity is indistinguishable from the model just being unsure, which isn't
  information the reader can act on.

## Why

Every other claim in Redline is checkable against the document (ADR-0001). Tying
hedging to sentence-level ambiguity keeps it checkable too — the reader can reread the
same quoted sentence and see the second reading for themselves, the same way they'd
verify a plain flag.

## Consequences

- A low confidence score for "is this actually harmful" (ADR-0006) never turns into
  hedged wording by itself — only ambiguity in the wording does. Low confidence for any
  other reason still produces a plainly-stated flag, or the clause gets dropped entirely
  under ADR-0004's plausibility filter.
- Flag generation has to distinguish two different kinds of uncertainty — textual
  ambiguity versus interpretive/consequential uncertainty — rather than a single
  confidence score. A model prompting/output-schema requirement, not decided further
  here.
