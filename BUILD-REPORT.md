# Redline v1 — build report

An autonomous build run. You were away; every question `CLAUDE.md` would normally
have sent back to you was decided here and recorded below with its reason.

**Ran:** 2026-09-11 to 2026-09-12
**Tickets:** GitHub issues #2–#20 in `rohanssoni/redline` (#1 is the spec).
**Result:** all 19 done. 454 tests across 37 files, `npx tsc --noEmit` clean,
`npm run build` green, and a live model run that verified every quote it printed.

---

## Where to start when you sit back down

1. **Run the migrations.** Seven files in `supabase/migrations/`, in order, against
   a fresh Supabase project. Nothing in this build has ever touched a live
   database, so this is the single largest untested surface. Read them before you
   run them — `0004`, `0005` and `0006` create a `metrics` schema whose whole
   purpose is that readers cannot reach it.

   ```
   0001_documents.sql                 documents + RLS
   0002_red_lines.sql                 red lines + RLS
   0003_red_line_match_judgments.sql  judge log, insert-only, no select policy
   0004_flag_dismissals.sql           dismissals + metrics.flag_dismissal_rates
   0005_counter_offer_copies.sql      copies + metrics.counter_offer_copies_by_stance
   0006_analysis_reads.sql            zero-flag rate + metrics.zero_flag_rate
   0007_anonymous_tries.sql           per-IP daily limit
   ```

2. **Put the two Supabase variables in `.env.local`** (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`), then `npm run dev` and sign up. Everything
   auth-shaped has been written and typechecked but never executed against a real
   Supabase.

3. **`npm run smoke`.** It reads the fixture contract with the real model and
   prints every flag with its source sentence, checking each against the file. It
   is the fastest way to see whether the pipeline still holds after any change.

4. **Read the calibration finding below before you judge the product.** The live
   run surfaced something about severity scoring that matters more than any code
   in this build.

---

## Ticket status

All nineteen are done, verified here (typecheck, that ticket's tests, the full
suite, and a diff read for stubs and TODOs) and closed on GitHub with their
acceptance criteria ticked and a comment recording how each was built.

| # | Ticket | Status |
|---|--------|--------|
| 17 | Landing page | **done** |
| 2 | Upload + summary (skeleton) | **done** |
| 3 | Ranked flags with source sentences | **done** |
| 4 | Gaps ranked alongside flags | **done** |
| 5 | Hedged wording only for ambiguity | **done** |
| 6 | Clean read | **done** |
| 7 | Zero-flag rate tracking | **done** |
| 8 | Soft counter-offer | **done** |
| 9 | Firm on demand | **done** |
| 10 | Editable red line list | **done** |
| 11 | Red line always flags | **done** |
| 12 | LLM judge on matches | **done** |
| 13 | Question box | **done** |
| 14 | Library | **done** |
| 15 | Dismiss a flag | **done** |
| 16 | Counter-offers sent | **done** |
| 18 | Paste text | **done** |
| 19 | No-account try | **done** |
| 20 | Keep a no-account analysis | **done** |

Nothing was blocked. No ticket needed a second attempt for failing verification;
the three retries in this run were infrastructure, described below.

---

## What the live model run showed

`npm run smoke` ran end to end against `z-ai/glm-5.3-flash` through OpenRouter
with the provider pinned to fireworks. **2 flags returned, 2 source sentences
verified, 0 dropped for a bad citation.** ADR-0001 held on a real call, which is
the thing the suite alone could not tell you.

Three findings, in the order I would look at them.

### 1. The flag stage scored every planted clause below the severity threshold

Both flags that reached the reader came from the **red-line** stage, at severity
5 and 4. The ordinary flag stage returned nothing clearing the threshold of 20 —
on a fixture containing uncapped indemnity, payment at the client's sole
discretion, unilateral scope change, IP assignment beyond the engagement,
termination for convenience with no payment, and a three-year non-compete.

**With no red lines set, this model would have called that document a clean read.**

The pipeline did exactly what ADR-0004, ADR-0008 and ADR-0013 specify. The code
is not wrong. What the run surfaces is that the live model's severity numbers and
the threshold constant do not currently agree, and the product's central promise
fails quietly in that gap — a reader gets told their adhesion contract reads as
normal. This is precisely the failure ADR-0011's zero-flag rate exists to catch,
which is some comfort, though the metric would be reporting a rate near 100%.

Worth checking first: whether the prompt anchors severity to a different scale
than 0–100, whether a threshold of 20 is right, and whether another model scores
it differently. I changed neither, because tuning severity is in no ticket and
the numbers in ADR-0011 and ADR-0016 were given as settled.

### 2. The judge contradicted its own reasoning, and ADR-0019 saved the flags

The judge returned `fits: false` on both red-line matches while its own reasoning
argued, at length and correctly, that each match holds — "signing it gives up the
ability the reader said they must keep". I checked the schema and prompt polarity
directly; both are right and consistent. This is the live model disagreeing with
itself.

Had ADR-0019 been written the other way, and disagreement suppressed the flag,
**both correct flags would have been silently dropped** and the reader would have
seen nothing at all. The decision to log rather than gate is vindicated by the
first real run. It is also a concrete instance of what ADR-0018 warns about: the
judge shares the blind spots of the model it checks, so it is a review-priority
signal and not proof of anything.

### 3. The counter-offer anchoring check fired, correctly

Asked to rewrite one sentence softly, the model returned a rewrite that appended
a portfolio carve-out. The echoed sentence no longer matched the flag's source
sentence, so the draft was dropped and the flag stood alone. Working as designed.

### One operational note

Two later smoke attempts failed with an upstream 429 — Fireworks rate-limiting
the model, surfaced because the provider is pinned with `allow_fallbacks: false`.
The script printed one plain line and exited 1 with no stack trace, which is the
error path behaving correctly. If this ever lands in CI, a shared-pool rate limit
will fail the job.

---

## Decisions made in your absence

### Tickets carry no Status line; labels are the status
The prompt said to read each ticket's Status line. These are GitHub issues and
have none. Status is tracked in the table above and on each issue via labels
(`ready-for-agent` → `done`), with criteria ticked in the issue body. Reason: the
issue is the source of truth per `docs/agents/issue-tracker.md`, and inventing a
Status line in a mirrored local file would create a second one that goes stale.

### Severity is a number plus a band
`severity: number` (0–100, higher is worse) drives ordering; `band` is what the
reader sees (high ≥ 67, medium 34–66, low ≤ 33). Reason: ADR-0005 requires flags
and gaps to interleave in one ordered list, which needs a total order, while the
reader needs a word rather than a number. See finding 1 — this scale may be part
of why the model's numbers came back low.

### The no-account limits (#19)
**3 anonymous analyses per IP per UTC day; 50,000 characters maximum.** A
freelancer's client agreement runs roughly 1,000–4,000 words, so 50,000 clears a
long one while capping what one anonymous request can cost; three tries lets a
visitor retry a failed parse and still try a second document, and bounds daily
spend in a product with no payments and no bot check. Recorded on issue #19.

### The anonymous limiter fails closed, with one deliberate exception
If the count query or insert fails on a configured project, the try is refused —
unmetered model spend is the thing the limit exists to prevent. **Exception: with
no Supabase project configured at all, tries run unmetered**, because there is
nothing to count with and your own constraint requires the app to analyse a
document with those variables absent. **Consequence to know before deploying: a
production deploy missing its Supabase variables would serve unmetered tries.**

### Three open design questions the briefs left unanswered
- **Where dismissed flags go (#15): nowhere.** They keep their rank, number and
  highlighted sentence, and only their weight changes. A flag is anchored to a
  sentence of the reader's own document, so filing it in a drawer cuts it from the
  only thing that makes it checkable; and renumbering what remains would make the
  read look like a different read each time the reader dealt with a clause.
- **Where red lines are edited (#10): their own screen at `/red-lines`.** The list
  belongs to the reader rather than to any document, and editing it beside a
  finished result would imply the result updates as you type, which it does not.
- **What the account menu holds:** not decided, because nothing in scope needed
  it. Sign-out lives in the shell.

### Hedging mechanism (#5), recorded as ADR-0022
The spec left this to the implementer. The flag stage returns textual ambiguity,
harm confidence, and the two alternative readings as separate fields, and
**Redline composes the hedge in code from those readings — the model never writes
its own hedge.** That makes ADR-0010 hold by construction: a hedge can only exist
when there are two readings to show the reader.

### Verbatim means whitespace-insensitive (#3), recorded as ADR-0021
Runs of whitespace collapse to one space on both sides; nothing else is
normalised, so case, punctuation and wording all still fail. The sentence stored
and shown is always the span cut from the document, never the model's string.

### "Launch" for the zero-flag baseline (#7)
The first finished read ever recorded, not a configured timestamp — a fact the
metric already holds, which cannot be forgotten at deploy time or go stale, and
which honestly reports "no launch yet" while nothing has been read.

### The run was interrupted three times by usage limits
Infrastructure, not the build. Handled by looking at what each dead agent left
rather than applying one rule.

- **#6** died having written one partial file. Deleted and restarted clean.
- **#9** died part-way through wiring the UI with the seam and its tests finished
  (267 tests passing, two typecheck errors, both in the UI layer). That work was
  **kept** and a second agent briefed to finish it — discarding twelve passing
  tests to re-derive them would have bought nothing.
- **#19** died before writing anything. Redispatched.

Nothing was committed in any broken state. A recurring self-check was scheduled so
the build resumes itself after a limit without you prompting.

---

## Not verified, and what it would take

**Everything involving a live Supabase.** No project exists. Auth, the library,
red lines, dismissals, copies, the zero-flag log and the anonymous rate limit are
written and typechecked but have never run against a real database. Tests stub the
Supabase client at the seam. To compensate, several suites **read the migration
SQL itself** and assert RLS is enabled, that every policy scopes to `auth.uid()`,
that there is no `anon` policy, and that no migration anywhere mentions
`storage.`, `create bucket`, `bytea`, `base64` or a file path. That checks the
policy text, not the database's enforcement of it. Run the migrations and sign up;
that is the gap.

**The Vercel deploy.** `npm run build` passes and `vercel.json` is in place, but
this run had no Vercel credentials and no deployment was performed.

**Any UI at the component level.** This repo has no DOM test infrastructure — no
`.test.tsx`, no jsdom — and adding one means a new dependency, which `CLAUDE.md`
says needs your decision. Every screen is typechecked and every behaviour behind
it is tested at the seam, but no test renders a component. **This is the largest
deliberate hole in the suite.** Closing it is a dependency decision
(`@testing-library/react` plus a jsdom environment) and a follow-up ticket.

**Browser file parsing against real files.** `pdfjs-dist` and `mammoth` run in the
browser and are exercised through their own logic, not against real PDFs and
.docx files. `pdf-text.ts` has unit tests for paragraph rebuilding, but no real
PDF was parsed in this run. Given ADR-0001, extraction fidelity is a correctness
concern: drop a real client agreement through `/documents/new` early.

**Whether the analysis is any good.** The suite proves the pipeline's guarantees
hold; it cannot prove the flags are the right flags. See finding 1 — the one live
run suggests severity calibration needs work before this goes in front of a
freelancer.

---

## Two things I would put in front of you first

1. **Severity calibration** (finding 1). The product's promise fails quietly when
   the flag stage scores real adhesion clauses below the threshold, and nothing in
   the build's scope was allowed to tune it.
2. **The `redLineMatches` payload** reaches the reader's own browser, where
   nothing renders it. It is the reader's own red line returning to them, so there
   is no disclosure — but if you would rather it stayed server-side, strip it in
   `app/api/documents/[id]/analysis/route.ts`.

Smaller, noted on their issues: the Gap Note now carries its rank numeral, a small
deviation from DESIGN.md made so the page gutter does not read 1, 2, 3, 5; and
question-box answers are not persisted, since the app shell brief lists that as
undecided.
