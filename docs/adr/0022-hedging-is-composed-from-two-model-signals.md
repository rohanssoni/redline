# Redline writes the hedge, from two separate signals the model reports

Status: accepted

ADR-0010 says a flag may hedge only where its source sentence is genuinely open to
more than one reading, and leaves the mechanics open. The mechanics are these.

The flag stage's structured output carries three fields per clause, filled in
independently: `harmConfidence` (`full` or `partial`), `textualAmbiguity` (a
boolean about the sentence's own wording), and `alternativeReadings` (the two
readings, one sentence each, empty where the model claims no ambiguity). One
schema, one call, three answers.

The hedged wording the reader sees is then composed in code, in
`lib/analysis/hedging.ts`, from the two readings. A flag hedges only where
`textualAmbiguity` is true *and* two usable readings came back with it. Where the
model claims ambiguity and supplies no second reading, the flag is worded plainly:
the claim on its own is a hedge with nothing under it.

One rule runs over every flag, hedged or plain: a sentence of explanation that
hedges about anything outside the document — how a court would rule, whether the
clause is enforceable, what is probable — is struck out before the reader sees it,
and logged. A flag with nothing left after that is dropped, because what remains
is a quoted sentence with no reading attached.

## Alternatives

- **A second classification pass over each flag.** Rejected for cost and for a
  worse failure mode: a separate pass decides ambiguity without the explanation in
  front of it, and the two can then disagree about the same sentence. One call
  that answers both questions at once keeps them attached to one reading of one
  clause.
- **Prompting alone, trusting the model's hedged prose.** Rejected because nothing
  checks it. The failure ADR-0010 exists to prevent — "this could allow…" attached
  to enforceability doubt — is invisible from the outside unless something in code
  can tell the two apart, and prose the model wrote is exactly where it hides.
- **One confidence score driving the wording.** Rejected by ADR-0010 already;
  recorded here because the schema is where it would have crept back in.
- **Dropping a flag whose model wording hedges unverifiably.** Rejected for
  recall (ADR-0006). The clause is still real and still citable; it is the hedge
  that has to go, not the flag.

## Why

The hedge and the evidence for it are the same piece of text. A reader who doubts
"this could be read two ways" has both readings in front of them and the quoted
sentence above them, and can settle it without leaving the page. That is the same
standard every other claim in Redline is held to (ADR-0001), applied to the one
kind of wording that could otherwise escape it.

## Consequences

- `Flag` carries `ambiguity` — the two readings and the hedge built from them —
  set only alongside `textualAmbiguity`. A hedge with no readings under it has
  nowhere to live in the type.
- The stored analysis is jsonb, so `toAnalysisResult` checks the same pairing on
  the way out and drops a row whose hedge has lost its readings, exactly as it
  drops a flag that no longer quotes the document.
- The wording of the hedge is Redline's, not the model's, so it can be edited in
  one place and goes through the humanizer skill like any other copy.
- The struck-out hedging is logged rather than shown. If the model starts hedging
  about courts at scale, the logs say so without the reader ever reading it.
