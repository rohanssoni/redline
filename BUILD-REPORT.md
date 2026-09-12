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
| 2 | Upload + summary (skeleton) | **done** |
| 3 | Ranked flags with source sentences | **done** |
| 4 | Gaps ranked alongside flags | **done** |
| 5 | Hedged wording only for ambiguity | **done** |
| 6 | Clean read | **done** |
| 7 | Zero-flag rate tracking | not started |
| 8 | Soft counter-offer | **done** |
| 9 | Firm on demand | in progress |
| 10 | Editable red line list | **done** |
| 11 | Red line always flags | **done** |
| 12 | LLM judge on matches | **done** |
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

### The no-account limits (#19)
The ticket left both open and said to record them before merge. Chosen here:

- **3 anonymous analyses per IP per calendar day (UTC).**
- **50,000 characters of extracted text maximum.**

Reason: a freelancer's client agreement runs roughly 1,000–4,000 words, so 50,000
characters clears a long one with room to spare while capping what a single
anonymous request can cost. Three tries a day lets a visitor retry a failed parse
and still try a second document before signing up, and bounds daily spend per IP
in a product with no payments and no bot check (a CAPTCHA is out of scope). Both
are enforced server-side in Supabase before any model call.

### Where the design briefs left a question open, the build answered it
Three surface-brief questions had no answer and no owner to ask: where dismissed
flags go and whether they can be restored (#15), whether red lines are edited on
their own screen or in a panel beside the result (#10), and what the account menu
holds. Each ticket brief tells the agent to decide, build, and record the choice
with its reason rather than stall on it.

### The run was interrupted twice by usage limits
Both interruptions were infrastructure, not the build. Each was handled by looking
at what the dead agent had actually left behind rather than applying one rule.

- **#6, 2026-09-11.** The agent died having written one partial file
  (`lib/analysis/analysis-error.ts`). It was deleted and #6 restarted clean: a
  single half-written file is a worse starting point than nothing. The suite was
  confirmed green (140 tests) before redispatching.
- **#9, 2026-09-12.** The agent died part-way through wiring the UI, with the seam
  and its tests finished — 267 tests passing, up from 255, and exactly two
  typecheck errors, both in the UI layer. That work was *kept* and a second agent
  was briefed to finish it rather than restart, since the state was verifiably
  coherent below the UI and discarding twelve passing tests to re-derive them
  would have bought nothing.

Nothing was committed in either broken state.

_(more decisions appended as the run proceeds)_

---

## Not verified

_(filled in at the end of the run)_
