---
name: checklist-review
description: Review a PRD, spec, or ADR in this repo against the standing checklist kept for that document type, and produce a saved report of what passed, what failed, and what's missing. Always use this when the user asks whether a document is "ready," "done," "complete," or asks to "review," "check," or "audit" a PRD, spec, or ADR — including a bare question like "are the specs ready?" or "is this ADR good to merge?" Also use before a spec would be published to the issue tracker (e.g. as a pre-check before /to-spec or /to-tickets), and when the user wants to add, update, or look at a review checklist itself. Do not use this for reviewing code changes (that's /code-review) or for writing a new PRD/spec/ADR from scratch.
---

# Checklist Review

Checks one PRD, spec, or ADR against the standing checklist for that document
type, and writes a report. It never edits the document under review — editing
is a separate job for the user or another tool. Its only output is a verdict
against each checklist item, plus, when warranted, a proposal to add something
new to the checklist.

## Why this exists

A document like a spec or an ADR has an implicit shape it's supposed to have —
required sections, things that must be cited, boundaries that must be stated.
Nobody wants to re-derive that shape from memory every time, and nobody wants
a silent drift where "ready" quietly starts meaning something looser than it
used to. The checklist makes that shape explicit and durable; this skill is
what actually holds a document to it.

## Checklist files

Each document type has its own checklist, stored in this repo at:

- `docs/checklists/prd.md` — for `PRD.md`
- `docs/checklists/spec.md` — for anything under `docs/specs/`
- `docs/checklists/adr.md` — for anything under `docs/adr/`

**If the relevant file doesn't exist yet, treat that checklist as empty** —
don't create it, and don't ask the user to run a setup step first. Review the
document on general judgment instead (see step 3 below), and let a real
checklist file get created the first time there's an actual item worth
keeping (see "Proposing a new checklist item").

A checklist file is a plain markdown list, one item per line, e.g.:

```markdown
# Spec checklist

- Every user story names an actor, a want, and a benefit — not just a task.
- Every implementation decision that reopens or touches an existing ADR says so by number.
- "Out of Scope" is present and non-empty.
```

## How to review a document

1. **Identify the document's type** from where it lives (see the mapping
   above). If it's none of these three, say so and stop — this skill doesn't
   have a checklist domain for it yet.
2. **Read the checklist file for that type**, if one exists.
3. **Go through the document against every checklist item**, one at a time,
   recording a pass or a fail with a one-line reason pointing at what's
   missing or wrong. If no checklist exists yet (or the checklist doesn't
   cover something you can see is genuinely wrong or missing), still review
   the document on general judgment — structural completeness, internal
   consistency, whether it contradicts something the repo already settled
   (an ADR, `CONTEXT.md`) — but keep these findings clearly separate from
   checklist verdicts in the report; see the report format below.
4. **Write the report** (see "Report format & location").
5. **Propose new checklist items where warranted** (see below) — as part of
   the same report, never as a silent edit to the checklist file.

## Proposing a new checklist item

When you notice something in step 3 that isn't on the checklist yet but is
the kind of thing that should hold for *every* future document of this
type — not just an issue specific to this one document — list it as a
**proposed checklist item** in the report and ask the user whether to add it.

Only add it to the actual checklist file after the user confirms. Never add
an item on your own judgment alone, and never drop a real finding just
because it isn't on the checklist yet — a finding that doesn't fit any
existing item still belongs in the report, flagged as "not yet on the
checklist" rather than left out.

If this is the very first item ever confirmed for a document type whose
checklist file doesn't exist, create the file at that point, with just that
one item. Don't scaffold the other two checklist files while you're at it —
create each lazily, on its own first confirmed item.

## Report format & location

Save the report as a sibling of the reviewed document, named
`<document-basename>-review-<YYYY-MM-DD>.md` (e.g. a review of
`docs/specs/0001-redline-v1-full-scope-spec.md` on 2026-09-09 is saved as
`docs/specs/0001-redline-v1-full-scope-spec-review-2026-09-09.md`). Each run
gets its own dated file rather than overwriting the last report, so a
document's review history stays visible over time.

Use this structure:

```markdown
# Review: <document title> — <date>

## Checklist verdicts
- [x] <item text> — pass
- [ ] <item text> — fail: <one-line reason>

(Or, if no checklist exists yet for this type: "No checklist exists yet for
<type>; reviewed on general judgment only.")

## Other findings
Anything genuinely wrong or missing that no checklist item covers.
Each one is either resolved by a proposal below, or noted as a one-off
specific to this document (not everything needs to become a standing rule).

## Proposed new checklist items
- <proposed item text> — <why this should hold for every future document of
  this type, not just this one>

(Omit this section if nothing rises to that bar this run.)
```

After writing the report, tell the user what you found in brief, and ask
about any proposed items before touching the checklist file itself.

## What this skill must never do

- **Never edit the document under review.** Not a typo, not a missing
  section — flag it in the report, don't fix it in place.
- **Never add or change a checklist item without the user explicitly
  confirming it first**, even when the addition seems obviously correct.
- **Never silently drop a real finding** because it isn't covered by an
  existing checklist item — surface it, either as a proposed item or as a
  one-off note.
