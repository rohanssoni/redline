# Trigger-eval status — resume from here

Stopped 2026-09-10 because the 5-hour usage quota was running out mid-loop.
This file is the durable record; the scratchpad copies used while working may
not survive across sessions.

## What's already validated (done, don't redo)

- The skill itself (`../SKILL.md`) is built and matches the design agreed via
  a grilling session: per-repo checklist, propose-then-confirm for new
  items, never edits the reviewed document, lazy checklist creation, dated
  sibling report files.
- **Real-document qualitative validation is done and good.** Three
  with-skill runs (ADR-0001, PRD.md, the v1 spec) all: created a correctly
  dated sibling report, never touched the reviewed document, correctly
  reported "no checklist exists yet" and reviewed on general judgment, and
  proposed rather than silently added checklist items. The spec run caught
  two real gaps (two PRD success metrics with no implementation mechanism;
  the merged flags+gaps list ADR-0005 requires isn't provable from the
  spec's stated data contract) — genuine value, not just following process.
- A true "without-skill" baseline turned out to be unachievable inside a
  single session — skill/command registration leaked into baseline
  subagents no matter how the file was isolated (see the two SendFeedback
  drafts filed during this work, still queued locally, not yet sent). The
  user decided to drop the quantitative with/without comparison and rely on
  the qualitative with-skill results above. Don't re-attempt this baseline.

## Trigger-eval automation: environment bugs found and fixed

`scripts/run_loop.py` (skill-creator plugin) didn't work on Windows out of
the box. Patched directly in the plugin cache (not project files) at
`~/.claude/plugins/cache/claude-plugins-official/skill-creator/85cce0381e78/skills/skill-creator/scripts/`:

- **`run_eval.py`**: `select.select()` on a subprocess pipe throws
  `WinError 10038` on Windows (select only works on sockets there). Replaced
  with a background reader thread + `queue.Queue`, same behavior on every
  platform. This fix is real and should be kept.
- **`run_loop.py`, `improve_description.py`, `generate_report.py`,
  `utils.py`**: several `Path.write_text()` / `read_text()` calls had no
  explicit encoding, so they crashed under Windows' default cp1252 codec the
  moment content contained a character like ✗. Added `encoding="utf-8"`
  throughout. Also real, also worth keeping.

These are plugin-cache patches, not project files — they won't show up in
`git status` for this repo and won't survive a plugin reinstall/update. If a
future session finds the loop crashing the same way again, re-apply the same
two classes of fix before assuming something new is wrong.

## What the loop actually found (4 iterations run, real data)

Eval set: `trigger-eval-queries.json` in this folder (20 queries, 10
should-trigger / 10 should-not, unchanged from what the user reviewed and
approved — no edits were made in the browser review step).

Full log: `trigger-eval-run-log-2026-09-10.txt` in this folder.

| Iteration | Train (pass/36) | Recall | Test (pass/24) | Recall |
|---|---|---|---|---|
| 1 (original description, unchanged in SKILL.md today) | 20 | **11%** | 13 | **8%** |
| 2 | 18 | 0% | 12 | 0% |
| 3 | 19 | 6% | 12 | 0% |
| 4 | *(in progress when stopped — no result)* | — | — | — |

**Precision was 100% in every iteration** — the skill never falsely
triggered on a should-NOT-trigger query, in any variant tested. The problem
is entirely recall: even the best variant only triggers correctly ~1 time in
10 on queries that should fire it, including ones as on-the-nose as
`"are the specs ready?"` and `"is PRD.md ready"`.

**The automated rewrites made things worse, not better**, across all 3
completed iterations. Iteration 1 (the description already in `SKILL.md`)
is still the best-scoring variant found. **Nothing needs to change in
`SKILL.md` based on this run** — don't take iteration 2, 3, or 4's proposed
wording and apply it; none of them beat the original.

## UPDATE 2026-09-10 (new session): root cause found, it's a test-harness bug, not a wording problem

The "short queries under-trigger structurally" theory above was wrong.
Directly running `claude -p "is PRD.md ready" --output-format stream-json
--verbose --include-partial-messages --model claude-sonnet-5` from the repo
root (no eval harness involved) showed the model invoking the **Skill**
tool as its literal first action, correctly and immediately, on the exact
query that scored 0-1/3 in every logged iteration.

The actual cause: `run_eval.py` tests trigger rate by writing an **ephemeral**
command file with a random-uuid-suffixed name
(`checklist-review-skill-<uuid>`) and checking whether the model's tool call
mentions that exact name. But the **real** `checklist-review` skill was
sitting in `.claude/skills/` for the entire duration of every trigger-eval
run (it was only ever removed for the earlier, separate baseline-isolation
problem, and correctly restored afterward). Given a should-trigger query,
the model reasonably invokes the real, already-installed `checklist-review`
skill by its real name — which is the *correct* behavior — but the harness's
strict name-match only recognizes the ephemeral uuid-suffixed variant, so it
silently scores every one of these correct, real triggers as a miss.

This explains everything the old theory didn't: why recall was low and
flat regardless of how the description was reworded (rewording the
ephemeral copy doesn't change whether the model picks the real skill by
name instead), and why precision stayed perfect throughout (the real skill
never fires on unrelated queries either way).

**Fix before re-running:** temporarily move `../` (the real
`.claude/skills/checklist-review/` directory) out of the repo for the
duration of the trigger-eval loop, exactly like the earlier baseline-
isolation technique — except here the goal is the opposite: make sure only
the ephemeral candidate exists, so the measurement reflects the candidate
description on its own merits instead of losing a popularity contest against
its own already-installed original. Restore it immediately after the run
finishes (or if it crashes/gets interrupted — don't leave the repo without
the real skill).

**Update, same session, after re-running with the real skill isolated:**
the shadowing theory above was only half right. With the real skill moved
out, recall went to a flat **0%** (worse, not better) across both iterations
run before quota cut off again. Root cause is more fundamental: `run_eval.py`
registers its ephemeral test variant as a file under `.claude/commands/`,
which Claude Code treats as a **slash command** (must be typed literally,
e.g. `/checklist-review-skill-<uuid>`), not as an autonomously-triggerable
**Skill** the way a real `.claude/skills/<name>/SKILL.md` is. A model has no
reason to run an arbitrary slash command for a natural-language query, so
recall was never really measuring description quality at all — it was
measuring a mechanism that doesn't do what the script assumes it does.

**Conclusion: abandon `scripts.run_loop` / `run_eval.py` for trigger
validation in this Claude Code version.** It's not a Windows-only problem
(the two encoding/socket bugs were real and are fixed, but this third issue
is a Claude Code version mismatch, unrelated to OS). The direct manual test
earlier in this file (real skill, no harness: `claude -p "is PRD.md ready"
...`) already proved the real skill triggers correctly and immediately —
treat that as sufficient trigger validation and don't sink further budget
into this automation. If a future skill-creator version fixes this, it's
worth retrying then.

**Also found:** the plugin was updated since 2026-09-10's first pass — the
active `skill-creator` version moved from `85cce0381e78` to `3ea32df27be7`.
Re-applied both Windows patches (thread+queue reader, `encoding="utf-8"`)
to the new active path; the old path's patches are stale/irrelevant now.
Check `plugins/cache/claude-plugins-official/skill-creator/` for the
currently active version (matches the `path` field in a `claude -p
--output-format stream-json` init event's `plugins` list) before assuming
either patch set is still in effect.

## How to resume

Re-run the loop (the two Windows patches above are still in place unless the
plugin was reinstalled/updated since 2026-09-10 — check first, they're
outside this repo):

```bash
cd ~/.claude/plugins/cache/claude-plugins-official/skill-creator/85cce0381e78/skills/skill-creator
python -m scripts.run_loop \
  --eval-set <path-to>/trigger-eval-queries.json \
  --skill-path <path-to>/.claude/skills/checklist-review \
  --model claude-sonnet-5 \
  --max-iterations 5 \
  --results-dir <somewhere-durable> \
  --verbose
```

Note: `--results-dir` only gets written if the run completes without
crashing (`run_loop.py`'s final write happens after the loop returns, not
per-iteration) — if it crashes again, the `--verbose` stderr stream (redirect
it to a log file, as done here) is the only durable record until it finishes.

The accuracy eval (planted-violation fixture documents testing whether the
skill actually catches the right checklist items) was scoped as a separate,
later piece from the start — still not started, not blocked on anything
above.
