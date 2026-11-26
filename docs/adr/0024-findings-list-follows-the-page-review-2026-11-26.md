# Review: ADR-0024, The findings list follows the page by default — 2026-11-26

## Checklist verdicts

No checklist exists yet for ADRs; reviewed on general judgment only.

## Other findings

- **Amendment is two-way — pass.** ADR-0024 says it amends ADR-0005, and ADR-0005's
  status line now points back to ADR-0024 and says what changed.
- **Scope of the decision — fail.** It says "the review screen", but there are two:
  the try review and the saved-document review. A reader cannot tell whether both
  change.
- **Glossary terms — fail.** `CONTEXT.md` now avoids "item" for a finding, and the ADR
  uses it four times for findings ("an item may claim", "picking an item", "the item
  that named it"). It also says "leader" where the glossary entry for Line up says
  "a line".
- **Behaviour matches the PRD — fail.** The PRD says picking a marked sentence on the
  page selects its entry in the list. The ADR leaves that out, so the two documents
  describe different behaviour.
- **Reasons are sourced — open.** The "Why" section is reconstructed from how the
  prototype behaves. The conversation that made the choice is not on record. The
  owner has to confirm it states their reason. One-off; not fixable from the repo.
- **Settled scope tension — raised, open.** `CLAUDE.md` scope item 2 says flags are
  "ranked by severity". The ADR names the tension in its consequences instead of
  routing around it, which is what `CLAUDE.md` asks. Whether `CLAUDE.md` needs a
  wording change is the owner's decision.
- **Considered options — pass.** All three prototype variants are named with the
  reason each lost, and the branch that holds them is named.

## Proposed new checklist items

- **An ADR that amends or supersedes another says so in its status line, and the
  older ADR's status line points back.** Without the back-pointer, a reader of the
  older ADR follows a rule that no longer holds.
- **An ADR uses `CONTEXT.md` terms, including the avoid lists.** Same reason as the
  PRD rule proposed on 2026-09-11: drift starts in the decision records.
