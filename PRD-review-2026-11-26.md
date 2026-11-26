# Review: Redline — PRD — 2026-11-26

Scope of this run: the section 2 changes for ADR-0024, and anything elsewhere in the
PRD those changes touch.

## Checklist verdicts

No checklist exists yet for PRD; reviewed on general judgment only.

## Other findings

- **ADR citations — pass.** ADR-0024 exists and says what section 2 claims: document
  order by default, a severity band on every flag, the Worst first switch, gaps after
  flags, and lining up.
- **Glossary terms — fail.** Section 2 says "what the item costs the reader" and "the
  list item" / "its item in the list". `CONTEXT.md` now names flag-or-gap a
  **finding** and avoids "item".
- **Which screens — fail.** Section 2 does not say whether the new order and lining
  up apply to the try review, the saved-document review, or both.
- **Section heading — pass.** "Flags and gaps, ranked by severity" still holds: every
  read is ranked, and the ranked order is one switch away.
- **Other sections — pass.** The landing page and try sections say "ranked flags" and
  "severity-ranked flags and gaps", both still true. No other section promises worst
  first as the order the reader sees first.
- **Product copy — one-off note.** The live copy on the landing page, try page,
  document page and sample review says "worst first". That copy is not in the PRD, so
  it is not a PRD failure, but it goes stale once the feature ships.

## Proposed new checklist items

None beyond the two proposed on 2026-09-11, which are still unconfirmed.
