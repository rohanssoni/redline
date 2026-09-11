# Review: Redline — PRD — 2026-09-11

## Checklist verdicts
No checklist exists yet for PRD; reviewed on general judgment only.

## Other findings

**Structural completeness — pass.** The document has scope (six capabilities,
each with its behavior fully specified), an explicit out-of-scope section,
success metrics, assumptions/risks, and an open-items section. Every
non-obvious rule is tied to an ADR number rather than asserted bare.

**ADR citations verified — pass.** All of ADR-0001 through ADR-0019 exist
under `docs/adr/` and each one checked (0001, 0002, 0008, 0016, 0017, plus
the numbers referenced throughout) says what the PRD claims it says. No
citation points at a decision that doesn't exist or has drifted from the
PRD's paraphrase.

**Consistency with `research/summary.md` — pass.** The two most load-bearing
claims — the freelancer segment being strongest on evidence, and the
consumer-ToS exclusion — trace cleanly to the research's §4 ranking and §5
verdict. The "willingness to pay is unvalidated" risk in the PRD's
Assumptions section is not glossed over; it's the same gap the research
flagged as "close this before writing a PRD" (§5, finding 1), and the PRD
states plainly that the decision was made to proceed without closing it
first. That's a real, live risk — but the PRD is honest about carrying it
rather than hiding it, which is the right way to handle a deliberately
accepted gap.

**Consistency with `CONTEXT.md` — pass.** Every defined term (red line, flag,
source sentence, counter-offer, prospective read, renewal read, gap,
severity, remedy question, stance, clean read) is used in the PRD exactly as
glossed, including the "avoid" synonyms (e.g. the PRD never says "citation"
or "quote" for source sentence).

**Internal consistency — pass.** No capability's behavior contradicts
another's. The citation requirement (ADR-0001) is correctly threaded through
every place it should bind: flags, red-line overrides (ADR-0013), and
counter-offers. The red line override is correctly scoped as "bypasses the
plausibility/confidence filter" rather than "bypasses the citation
requirement," stated twice (capabilities 2 and 5) and consistently both
times.

**"Open items before build: None" — plausible, one soft caveat.** The claim
that every item raised is resolved through ADR-0019 checks out against what
exists in `docs/adr/`. The one thing this review can't verify from the repo
alone is completeness of a different kind: whether a PRD this detailed is
missing a capability the team intends to build (rather than misstating one
it lists). That's a judgment call for you, not something a document review
can catch.

No one-off issues found that aren't already covered above.

## Proposed new checklist items

Since no PRD checklist exists yet, consider whether these are worth making
standing rules (I did not add them — confirm first):

- **Every non-obvious behavioral rule cites the ADR that decided it, and that ADR exists and says what's claimed.** This is what made this review tractable; worth holding every future PRD to the same standard rather than re-deriving it each time.
- **Every defined term is used per `CONTEXT.md`'s glossary, including its "avoid" list.** Catches terminology drift before it reaches engineering.
- **A risk carried forward from `research/summary.md` without being closed is stated as such, with the date and reasoning for proceeding.** This PRD does it well for the willingness-to-pay gap; worth requiring it every time research flags something a PRD then chooses not to resolve.
