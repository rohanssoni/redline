# Redline v1 — build report

An autonomous build run. The owner was not present; every question `CLAUDE.md`
would normally have sent back to them was decided here and recorded below with
its reason.

**Started:** 2026-09-11
**Tickets:** GitHub issues #2–#20 in `rohanssoni/redline` (#1 is the spec).

---

## Where to start when you sit back down

_(filled in at the end of the run)_

---

## Ticket status

| # | Ticket | Status |
|---|--------|--------|
| 17 | Landing page | in progress |
| 2 | Upload + summary (skeleton) | not started |
| 3 | Ranked flags with source sentences | not started |
| 4 | Gaps ranked alongside flags | not started |
| 5 | Hedged wording only for ambiguity | not started |
| 6 | Clean read | not started |
| 7 | Zero-flag rate tracking | not started |
| 8 | Soft counter-offer | not started |
| 9 | Firm on demand | not started |
| 10 | Editable red line list | not started |
| 11 | Red line always flags | not started |
| 12 | LLM judge on matches | not started |
| 13 | Question box | not started |
| 14 | Library | not started |
| 15 | Dismiss a flag | not started |
| 16 | Counter-offers sent | not started |
| 18 | Paste text | not started |
| 19 | No-account try | not started |
| 20 | Keep a no-account analysis | not started |

---

## Decisions made in the owner's absence

### Tickets carry no Status line; labels are the status
The build prompt said to read each ticket's Status line. These tickets are GitHub
issues and have no such line. **Status is tracked here, in the table above, and on
the issue via labels** (`ready-for-agent` → `done`), with the acceptance criteria
ticked in the issue body on completion. Reason: the issue is the source of truth
per `docs/agents/issue-tracker.md`, and inventing a Status line in a mirrored
local file would create a second one that goes stale.

### Severity is a number plus a band
`severity: number` (0–100, higher is worse) drives ordering; `band: 'high' |
'medium' | 'low'` is what the reader sees (high ≥ 67, medium 34–66, low ≤ 33).
Reason: the PRD requires flags and gaps to interleave in one severity-ordered
list (ADR-0005), which needs a total order, while the reader needs a word, not a
number. A band alone cannot order within a band.

_(more decisions appended as the run proceeds)_

---

## Not verified

_(filled in at the end of the run)_
