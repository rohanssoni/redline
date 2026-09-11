# Redline

A web app where someone uploads a contract, lease, freelance agreement, or terms
of service and learns what they are actually signing.

## Read first

- `research/summary.md` — the user research. Read it before deciding what the product should do.
- `PRD.md` — the brief, once it exists. Read it before building.

## Settled decisions

Not open for reinterpretation. If one of these looks wrong, raise it — do not route around it.

- Next.js, Supabase for auth and database, deployed on Vercel.
- The uploaded file is parsed in the browser. Only the extracted text is stored — never the original file.
- Every risk flag cites the exact sentence it came from. **A flag whose source sentence cannot be shown is a bug**, not a degraded result. Do not ship a code path that can produce one.
- The product calls its model through OpenRouter.

## Scope

Build these capabilities and stop:

1. Plain-English summary of the document.
2. Clauses that could hurt the reader, ranked by severity, each showing its exact source sentence.
3. A drafted counter-offer for each flagged clause.
4. A question box that answers only from the document.
5. An editable list of the user's own red lines, which drives the analysis.
6. A saved library of past documents.
7. Pasted text as an alternative to uploading a file. Upload stays the recommended input.
8. A landing page that demonstrates flags with their source sentences and offers one action, trying it on a document. That try works once without an account and returns only the summary and ranked flags.

When something looks like the obvious next step and is not on that list, ask before building it.

**Excluded on purpose:** payments, billing, OCR for scanned documents, and sharing a
document between users. This version exists to prove the analysis can be trusted, and
none of those make it more trustworthy. OCR would actively undermine it: a citation is
worthless when the text it points at was misread.

## Standing rules

- Keep credentials in `.env.local`, which is gitignored. Never commit a secret — a key is public the moment it is pushed and has to be rotated.
- State only what the document says. Where the text does not support a claim, the product does not make it. This applies to summaries, severity rankings, counter-offers, and question answers alike.
- Ask before adding a dependency. `pdf.js` and `mammoth` for in-browser parsing are already approved; everything else needs a decision.
- All copy a user reads in this product, meaning the landing page, UI labels, error messages and empty states, has to be run through the humanizer skill before it is committed. Copy that reads as though a model wrote it is a defect, not a matter of taste.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `rohanssoni/redline`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
