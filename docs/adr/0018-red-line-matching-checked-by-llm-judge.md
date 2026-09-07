# Red-line matching quality is checked via LLM-as-judge

Status: accepted

Semantic red-line matching (ADR-0015) is evaluated using a second, independent model
call that judges whether a flagged match reasonably fits the red line's intent, rather
than a human-labeled test set of red-line/clause pairs.

## Alternatives

- **Human-labeled test set of red-line/clause pairs.** The stronger evidentiary
  standard, consistent with this project's general bias toward verifiable claims
  (ADR-0001) over cheap automation — an independent human judgment is ground truth in a
  way a second model call is not. Rejected for cost and scale: a labeled set needs
  ongoing human upkeep as new red-line phrasings appear, while a model judge scales
  automatically to whatever a reader writes, without a labeling pipeline to maintain.

## Why

Semantic-match volume grows with every reader-authored red line, and human labeling
can't keep pace with the open-ended phrasing readers will actually type. A model judge
trades some rigor for coverage that scales with usage instead of falling behind it.

## Consequences

- **This is a real compromise on rigor.** Unlike ADR-0001's citation check — a verbatim,
  mechanically verifiable test — an LLM judge shares the same blind spots as the model
  it's checking: a misunderstanding common to both would not be caught by either. Treat
  its output as a review-priority signal, not proof of correctness.
- A human-labeled set is still worth building as a periodic audit even though it isn't
  the primary method — revisit this if the judge's disagreement rate stays suspiciously
  low (not catching real problems) or suspiciously high (matching itself needs
  retuning).
- Needs a disagreement-handling policy: when the judge disagrees with a match, is the
  flag held back, shown with a lower-confidence marker, or just logged for review? Not
  decided here.
