# The eval suite

`npm run eval` reads every document in the gold set through the same pipeline
`npm run smoke` uses, against the real model, and reports recall, groundedness and
clean-document flags. What the numbers mean for the product is in `PRD.md`, "How we
measure it". This file is how it works and every decision made building it.

```
npm run eval        # real model calls, needs OPENROUTER_API_KEY and OPENROUTER_MODEL in .env.local
npm test            # includes eval/gold-set.test.ts and eval/scoring.test.ts, no network
```

The gold set is not kept in this repo. The eval reads it from `redline-gold-set`,
a folder beside the repo folder that holds `corpus/` and `fixtures/`. To keep it
somewhere else, set `EVAL_GOLD_SET_DIR` in `.env.local` to that folder. Without
the gold set, `npm run eval` stops with a message, and `npm test` skips the tests
that read it.

Each run writes `eval-runs/<start time, UTC>.txt` (the printed report) and `.json`
(every rate, every planted clause, and every flag with its document, clause type,
severity, quoted sentence and whether it matched a planted clause).

## The limit

A model wrote the gold set. The clauses are hidden the way a model knows how to hide
them and phrased the way a model recognises, so every figure is an upper bound on how
the analysis does on real contracts. No figure from a run belongs in copy a reader
sees. `corpus/README.md` in the gold set folder explains this at more length.

## Files

| Path | What it is |
|---|---|
| `gold-set.ts` | Finds the gold set folder and reads `manifest.json` and the sidecars. |
| `scoring.ts` | Clause type mapping, scope, overlap, character classes, all the rates. No model, no network. |
| `gold-set.test.ts` | Every gold-set sentence appears exactly once in its document. Part of `npm test`. |
| `scoring.test.ts` | The scoring rules, on hand-built runs. Part of `npm test`. |
| `../scripts/eval.mts` | The runner. |

## Decisions

Each of these is a call I would normally have asked about. I made it, and the reason
is here so it can be overturned.

**1. No eval existed before this.** I checked `package.json` for an `eval` script,
`.scratch/redline-v1/issues/` and the GitHub issues for an eval ticket, and the repo
for a folder of run records. None existed. The only things named "eval" are the
red-line judge (ticket #12, ADR-0018), which is a runtime check on red-line matches
and measures nothing against a known answer, and a line in `research/summary.md`
saying evaluated accuracy is likely a requirement.

**2. The branch is cut from `master`.** The brief said `main`. This repo has no
`main`, and `master` is its default branch.

**3. The PRD names its sections differently.** It has no "What good looks like" or
"My red lines". The nearest are "Success metrics" and capability 2, whose
dangerous-vs-unusual test (ADR-0004) is the PRD's definition of what gets flagged:
a clause that lets the other side change the reader's economics on its own after the
reader is committed. A clause that binds both sides the same way is dropped,
however unusual. Scope below is decided against that test.

**4. The gold set lives outside the repo, and its bytes must not change.** Its
documents carry non-breaking spaces, ligatures, double spaces and LF line endings on
purpose, and every planted sentence is an exact substring of them. Copy the folder
as files, never through a tool that converts line endings. On this machine
`core.autocrlf=true`, so a git checkout of the files would write CRLF and break
every match.

**5. Only the corpus and fixtures are used.** An eval has to drive this product's
pipeline, so it brings no runner of its own. The fixture PDFs and question sets sit
in the gold set folder and the eval doesn't score them. Their sentences are still
checked by the gold-set test.

**6. Scope: six of the seven gold-set types are in, and arbitration is out.**

| Gold-set type | In scope | Why |
|---|---|---|
| `unilateral-modification` | yes | ADR-0004's own example of a dangerous clause ("unilateral scope amendment"). |
| `fee-escalators-and-late-fees` | yes | Lets the other side charge or raise what the reader pays. The flag prompt names fees and late payment. |
| `auto-renewal` | yes | Commits the reader to another term at "the then-current rate", which the other side sets. The flag prompt counts a cost fixed in advance. |
| `non-compete` | yes | One-sided, and limits what the reader can earn after the agreement. The flag prompt counts a right the reader gives up. |
| `limitation-of-liability` | yes | Caps what the other side owes the reader, and every instance in the gold set caps one side only. |
| `indemnification` | yes | Puts the other side's costs on the reader. |
| `arbitration-and-class-action-waiver` | **no** | It moves no money and no obligation, so it fails the ADR-0004 test. All five gold-set instances send a dispute to arbitration whichever side brings it, and two say outright that both sides agree ("You and Cascade agree", "You and Ardent each agree"). That is the symmetric kind of clause the PRD says to drop. |

Arbitration is out of scope, so a missed arbitration clause is never counted as a
miss. The run still prints how many the product flagged anyway, as an information
line outside the recall figure. This is the most arguable call here. The flag prompt
does say "a right the reader gives up" counts, and an arbitration waiver can be read
as one. If the owner reads it that way, remove the entry from `OUT_OF_SCOPE` in
`scoring.ts`, and recall will count five more clauses.

**7. The clause type mapping.** This product's `clauseType` is free text, three or
four words the model chooses. Each one is lower-cased and mapped to the first rule
below that it matches, in this order. Order matters: "uncapped indemnity" has to
reach indemnification before anything reads "cap", and "amend the fee schedule" is
a modification before it is a fee.

| Order | Gold-set type | A product type maps here when it contains |
|---|---|---|
| 1 | `arbitration-and-class-action-waiver` | arbitrat, class action, jury, right to sue, court waiver |
| 2 | `indemnification` | indemn, hold harmless, defend |
| 3 | `limitation-of-liability` | liabilit, damages cap, recovery cap, cap on damages/recovery/claims, limited recovery/remedies |
| 4 | `non-compete` | compet, solicit, restrictive covenant, restraint of trade, exclusiv |
| 5 | `auto-renewal` | renew, rollover, evergreen, automatic extension/continuation, term extension |
| 6 | `unilateral-modification` | amend, modif, terms change, change to/of the terms, unilateral scope/terms/change, scope change, rewrite, variation |
| 7 | `fee-escalators-and-late-fees` | fee, pric, rate(s), interest, late, charge, escalat, surcharge, tuition, dues, penalt, payment |
| none | unmapped | anything else, such as "IP assignment" or "portfolio restriction" |

The exact patterns are `CLAUSE_TYPE_RULES` in `scoring.ts`, and each run's JSON
records the ones it used. The mapping only decides "named the right type". It has no
effect on whether a clause counts as found.

**8. Found means overlapping spans.** Both sentences are located in the document text
the pipeline reads, after `normalizeDocumentText`. That function turns non-breaking
spaces into plain ones and collapses runs of spaces, so the planted sentence is
normalised the same way before it is looked up. A planted clause is found when any
flag shown to the reader quotes a span that shares at least one character with it.
Only shown flags count, because those are what a reader gets.

**9. Groundedness is measured on what the model returned, before any filter.** The
pipeline throws away a flag whose quote it cannot find, and the plausibility filter
drops others first, so the shown flags can't measure this. The runner wraps the
OpenRouter client in a recorder that keeps a copy of each reply and changes nothing
it passes on, and scores every flag in the `document_flags` reply. The headline
figure checks the quote against the normalised text, because ADR-0021 says verbatim
means whitespace-insensitive, and that's the text the pipeline checks. A stricter
figure against the file on disk is printed beside it, along with the shown flags'
groundedness, which should always be 100 percent. The red-line stage doesn't run
(decision 10), so it contributes no flags.

**10. No red lines.** The gold set defines none, so every document is read with an
empty list. That's the read a visitor gets on the no-account try, and it means the
red-line stage and its judge make no calls.

**11. No counter-offers.** The smoke run drafts one counter-offer for the worst flag.
The eval skips it, because no metric here reads a counter-offer and the draft would
add a model call per document. The read itself (`analyzeDocument`, with the same
normalisation and the same client) is unchanged.

**12. What a failed call is.** A document is left out of every denominator when a
model call throws: refused by OpenRouter, unreachable, empty, or not matching the
schema. The report says how many and why. A document the model reads and calls "not
an agreement" is different. The call worked and that's the product's answer, so it
is scored as a read that showed no flags, and recall counts its planted clauses as
missed. The report names any document this happens to.

**13. Clean documents count shown flags only.** Gaps aren't flags (ADR-0005), so a
gap on a benign document isn't counted as an over-flag. It is printed beside each
benign document, along with whether the document got the clean read. The run also
counts flags on the gold set's unusual-but-harmless sentences.

**14. Documents run one at a time.** The OpenRouter provider is pinned with no
fallback and turns calls away when its pool is full (`lib/model/openrouter.ts`).
Running nine reads in parallel would mostly measure that.

**15. Run records are committed.** "A folder of eval run records" is how the brief
describes an existing eval, so `eval-runs/` is kept in git, not ignored. Each file is
named for the run's start time in UTC with colons replaced, so names sort in time
order and work on Windows.

**16. A run that scores no documents exits non-zero.** Every figure in it is 0/0, and
a script that exits 0 there would look like a pass to anything that only reads the
exit code.

## Runs

- `2026-10-30T16-23-20Z`: no figures. Every call came back `API key expired. [HTTP 401]`
  from OpenRouter, so all nine documents were left out. The key in `.env.local` needs
  replacing before the eval can measure anything.
