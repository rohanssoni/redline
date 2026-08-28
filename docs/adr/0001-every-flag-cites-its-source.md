# 0001 — Every flag cites its source sentence

Status: accepted

## Decision

Every risk flag Redline produces carries the exact sentence from the uploaded document
that it came from, shown to the reader alongside the flag. The quoted text must match
the stored document text verbatim, and the system verifies that match before the flag
is displayed. A flag whose source sentence cannot be shown is a bug, not a formatting
preference — it does not get rendered without its citation, and it does not get rendered
with an approximate one.

## Alternatives

- **Let the model describe risks in its own words, with no quoting.** Fluent and easy to build, and it never fails to produce output. But the reader cannot tell a real finding from an invented one, and neither can we.
- **Cite the clause or section number instead of the sentence.** Cheaper to extract, but sends the reader back into the document to hunt — the exact work the product exists to remove — and section numbering is unreliable across formats.
- **Quote loosely: let the model paraphrase or clean up the sentence it found.** Reads better. Makes verbatim verification impossible, so a fabricated quote and a tidied real one are indistinguishable.
- **Show citations where available, degrade gracefully when not.** Every uncited flag then teaches the reader that citations are optional, which costs the cited ones their weight.

## Why

The reader can check us. For any flag, they can find that sentence in their own document
and decide for themselves whether our reading of it is fair — without trusting Redline,
and without a lawyer. That is the only claim this product can make that a general-purpose
chatbot cannot, and it is a claim the reader can falsify in seconds.

It is also the failure mode competitors are visibly judged on: paid tools in this category
carry reviews saying the AI "is prone to making mistakes requiring vigilant review"
(`research/summary.md`). Verifiability is the wedge, so it cannot be a best-effort feature.

## Consequences

- **Flags we cannot ground get dropped, not softened.** We will miss real risks that live across scattered language rather than in one sentence. We accept lower recall for verifiable precision.
- **The model returns spans, not prose.** Its output must be structured to include the source text (or offsets into it), and every span is checked against the stored document before display. That check is the test — an analysis test asserts every flag's quote is findable in the source, and a flag that fails is a failing test.
- **Extraction fidelity becomes a correctness concern, not a convenience.** Whatever the browser parser produces is the text every citation points at, so parser bugs surface as citation bugs.
- **OCR stays excluded** (see `CLAUDE.md`). A citation into misread text looks exactly as trustworthy as a real one and is worth nothing.
- **Counter-offers inherit the constraint.** A drafted counter-offer is anchored to the clause it rewrites, so it cannot argue against terms the document does not contain.
