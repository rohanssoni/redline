# Shared brief — Redline v1 build

Every subagent on this build reads this file first, then its own ticket brief.
You have no memory of any earlier session. Everything you need is here or in the
files this points at.

## Read before you write code

- `CLAUDE.md` — settled decisions and standing rules. Binding.
- `PRD.md` — what to build.
- `CONTEXT.md` — the glossary. **Use these exact words** in code identifiers, UI
  copy and comments: red line, flag, source sentence, counter-offer, prospective
  read, renewal read, gap, severity, remedy question, stance, clean read. Avoid
  the synonyms that file lists.
- `PRODUCT.md` — audience, positioning, principles.
- `DESIGN.md` — the design system (visual world: Tracked Changes). Binding for
  every screen.
- `.impeccable/surfaces/app-app-layout-tsx.md` — the app shell brief (signed-in
  frame). Binding for every signed-in screen.
- `.impeccable/surfaces/app-page-tsx.md` — the landing surface brief.
- `.scratch/redline-v1/spec.md` — the full v1 spec, including the seam contracts.
- The ADRs your ticket cites, under `docs/adr/`.

## The two answers the build owner pre-decided

`CLAUDE.md` tells you to stop and ask about these. Do not ask. These are the answers.

### 1. The model

- Called through OpenRouter's **OpenAI-compatible endpoint**
  (`https://openrouter.ai/api/v1/chat/completions`) with `OPENROUTER_API_KEY`.
- The model id is **whatever `OPENROUTER_MODEL` says at runtime**. **Never write a
  model id into code**, not as a default, not as a fallback, not in a comment.
  If `OPENROUTER_MODEL` is absent the client throws a clear error.
- Pin the provider on every request:
  `provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true }`.
- `reasoning: { effort: "low" }` on every request.
- Every analysis and answer call requests **structured JSON output**
  (`response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`).
- Credentials live only in `.env.local`, which is gitignored. Never commit a secret.

### 2. Supabase

- **No Supabase project exists yet.** Nothing can be run against a live database.
- Build sign-in, the library and red lines against the Supabase client, reading
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Every table, index and RLS policy is written as a **SQL migration file under
  `supabase/migrations/`**, named `NNNN_description.sql`. The build owner runs
  these by hand. Do not attempt to apply them.
- **The app must start and analyse a pasted document with those two variables
  absent.** Only the library, red lines, auth and the anonymous rate limit need
  Supabase. Code that reads Supabase must degrade to a clear, reader-facing
  "sign-in isn't set up yet" state rather than crashing the app or the build.
- **Do not mock auth in the product.** A fake session object shipped in
  application code is a defect. Tests may stub the Supabase client at the seam.

## What does not count as done

A ticket containing any of these is still open, however green the suite is:

- A function that returns a fixed value instead of doing the work.
- A `TODO`, a `not implemented` throw, or a stubbed-out branch in product code.
- A test that only checks a file exists, or that a function is defined, or that
  a type compiles.
- A test that mocks the very thing it is meant to be testing.

Tests stub **the model client** and **the Supabase client** — the two things that
reach outside the process. Everything between them is exercised for real.

## Fixtures

- `tests/fixtures/` holds two documents and their sidecars. Every test that needs
  a document uses these. Do not invent new inline contract text in a test file.
- The test model client is a **stub built from the sidecar**, so the suite runs
  with no API key and makes no network call. Ever.

## Conventions

- Next.js App Router, TypeScript, plain CSS, Vitest. Approved dependencies:
  `pdf.js` (`pdfjs-dist`), `mammoth`, `@supabase/supabase-js`,
  `@supabase/ssr`. **Ask before adding anything else** — in this build, "ask"
  means: do not add it, and say so in your final report.
- Severity is `severity: number` (0-100, higher is worse; drives ordering) plus
  `band: 'high' | 'medium' | 'low'` (what the reader sees). Sort descending by
  `severity`; flags and gaps sort together in one list.
- All copy a reader sees — labels, buttons, errors, empty states — goes through
  the **humanizer skill** before you commit it (`CLAUDE.md`). Invoke it with the
  Skill tool on the copy you wrote. Copy that reads as model-written is a defect.
- Do not start an impeccable direction round. It opens a browser and waits for a
  person, and nobody is here.
- Do not commit. The orchestrator commits. Leave the working tree with your
  changes in it and report what you changed.

## Test command

`npm test` (Vitest, `vitest run`). Typecheck: `npx tsc --noEmit`.
Build: `npm run build`. All three must pass before you report done.

## Reading the adhesion sidecar correctly

`tests/fixtures/adhesion-agreement.json` lists **every** planted clause in
`flags[]`, including ones that must not reach the reader under some conditions.
Read the per-flag metadata, not just the array:

- `plausible: false` — the red-line-only clause. With **no** red lines supplied it
  must be dropped by the plausibility filter and must NOT appear in output. With
  its red line supplied it must appear (ADR-0013).
- `textualAmbiguity: true` — the only flag that may carry hedged wording (ADR-0010).
  Exactly one flag has it.
- `harmConfidence: "partial"` — still flagged (ADR-0006), and plainly worded
  unless `textualAmbiguity` is also true.
- `decoys.symmetricUnusual` is deliberately absent from `flags[]`. A run that
  produces a flag for that sentence is wrong (ADR-0004).

So "the expected flags for a run with no red lines" is
`flags.filter(f => f.plausible !== false)`, and with the red line supplied it is
all of them.
