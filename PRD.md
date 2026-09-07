# Redline — PRD

Redline reads a document someone is about to be bound by and tells them what it
actually says. V1 serves one **prospective read** for one segment: a freelancer or
independent contractor about to sign an agreement sent to them by a client.

Terminology below follows `CONTEXT.md`. Decisions below are settled; see the cited
ADRs for why — this document states what to build, not why, except where a
requirement doesn't yet have an ADR to point at.

## Who this is for, and who it isn't

**Freelancers and independent contractors reading a client's agreement.** ADR-0002.
Not job-seekers, not renters, not consumer ToS.

That last exclusion narrows `CLAUDE.md`'s original framing ("a contract, lease,
freelance agreement, or terms of service") further than the settled-decisions list
does explicitly, so it's worth stating plainly here: **v1 does not target consumer
terms of service**, even though nothing in `CLAUDE.md` forbids it by name. Two
independent reasons converge on this. First, ADR-0002 already scopes the reader to
freelancers negotiating with clients — a ToS is not that. Second, `research/summary.md`
§5.2 found the best-evidenced clause harms (auto-renewal, arbitration waivers) live
in take-it-or-leave-it consumer ToS with no counter-offer to draft, while a free
competitor (ToS;DR) already covers the major services. Building for ToS would mean
building the one capability — counter-offers — that doesn't apply there. **Flag for
sign-off:** this is a real narrowing of the product description in `CLAUDE.md`, not
just an ADR restatement; confirm it before treating it as settled.

**Known, accepted gap:** only 28% of freelancers use a contract for any given gig
(ADR-0002). Redline reads documents; the 72% without one get nothing from v1. Not a
defect — generating an agreement is deferred until the reading product finds fit.

## Scope

The six capabilities below, and nothing else. When a feature idea doesn't appear
here, it needs a decision before it gets built, per `CLAUDE.md`.

### 1. Plain-English summary

A summary of the uploaded document in plain language. No severity, no citations
required at the summary level — those belong to flags and gaps, not the summary.

### 2. Flags and gaps, ranked by severity, each showing its source

Two output types, both rendered in one severity-ordered list (ADR-0005):

- **Flag** — a clause capable of harming the reader. Always shows its exact
  **source sentence**, verified verbatim against the stored document text before
  display. A flag that fails that check does not render — not with an approximate
  quote, not without one (ADR-0001). No exceptions for severity: a gap never becomes
  a citable flag no matter how severe (ADR-0005, confirmed 2026-09-07, no amendment
  to ADR-0001).
- **Gap** — a term the agreement should contain but doesn't. No source sentence;
  checkable only against the whole document ("this agreement contains no
  late-payment term"). Ranks by severity alongside flags but cannot claim a
  citation (ADR-0005).

**Severity** ranks what the item costs the reader if it fires, not how often it
fires (ADR-0004). Use the dangerous-vs-unusual test from ADR-0004: a clause that
lets the other side change the reader's economics unilaterally after the reader is
committed is dangerous; a non-standard but symmetric clause is not, and gets
dropped rather than ranked low.

**Confidence handling:** a citable clause is flagged even when the model's
confidence in the interpretation is partial — recall is favored over avoiding false
alarms, because the citation itself gives the reader a free way to check and
dismiss a flag that doesn't hold up (ADR-0006). Flag wording may use calibrated
hedging ("this could allow...") to reflect that partial confidence, rather than
stating flatly or being omitted (ADR-0007).

> **Build-blocking open item:** ADR-0007 permits hedging language but does not yet
> bound it. Before this ships, define what hedging vocabulary may and may not
> imply — specifically, that it can express uncertainty about interpretation but
> never imply a claim the source sentence doesn't support (`CLAUDE.md`'s "state
> only what the document says" rule still applies to a hedged flag).

**Clean read:** a document with no flags or gaps above the severity threshold
returns a dedicated "this reads as a normal agreement" result — a first-class
outcome, not an empty list (ADR-0008). The production zero-flag rate is tracked as
a health metric: if it's near zero, the severity filter is broken, and this metric
is the only thing that would show it. (Baseline/threshold for "too high or too low"
is not yet decided — ADR-0008.)

### 3. Drafted counter-offer per flagged clause

Every flagged clause gets a drafted replacement, anchored to that clause — never a
whole-agreement rewrite, and never arguing against terms the document doesn't
contain, since it inherits ADR-0001's grounding constraint.

**Stance** — soft or firm — is chosen by the reader per flag, not fixed by the
product. Defaults to soft; the reader overrides to firm on a clause where they
know they have standing (ADR-0009). Soft is the default because leverage is a
property of the specific clause and relationship, not a global trait of the
freelancer, and most readers won't know their leverage in the abstract — they
recognize it clause by clause.

Gaps do not get counter-offers in v1: a counter-offer replaces existing language,
and a gap has none to replace. (Not decided by an ADR — stated here as the default
reading of "counter-offer" in `CONTEXT.md`; flag if a different behavior — e.g.
drafting clause language to fill the gap — is wanted.)

### 4. Question box, answered only from the document

Answers are constrained to what the uploaded document says. Where the text doesn't
support an answer, the product says so rather than reasoning toward a guess
(`CLAUDE.md`, ADR-0007's uncertainty-by-omission principle for this feature
specifically — note ADR-0007 changed the *flag* behavior to allow hedging, but the
question box keeps the plain-or-omit rule since a question has no citation of its
own to lean on the way a flag does).

**Remedy questions are declined, not answered.** ("They haven't paid me, what are
my options" is declined even on an already-signed document.) The boundary is the
question asked, not the document's age or ingest path — a **renewal read** on an
already-signed document is fully supported for questions about what to negotiate
next; the same document can't be used to ask what to do about a breach that
already happened (ADR-0003). When declined, the product says why, rather than
staying silent.

### 5. Editable red line list

The reader authors and edits a list of **red lines** — terms decided in advance as
unacceptable. This list persists across documents and drives the analysis (i.e.,
a red line violation should surface as a flag, or raise an existing flag's
severity — exact mechanics not yet specified; flag for a follow-up decision before
build).

### 6. Saved library of past documents

Past analyses are saved and browsable. Only the extracted text is stored — never
the original uploaded file (`CLAUDE.md`, settled). This is what makes the red line
list and renewal reads useful across sessions rather than per-upload.

## Explicitly out of scope

Payments, billing, OCR for scanned documents, and sharing a document between
users — see `CLAUDE.md` for why. Consumer terms of service — see "Who this is
for," above, an addition to that list made in this document.

## Success metrics

- **Counter-offer sent** (primary). The freelancer needs the client more than the
  reverse, so a counter-offer that gets sent beats a stronger one that doesn't
  leave the app (ADR-0009). Segment by stance (soft vs. firm) sent — the split is
  itself a signal about whether stance defaults are calibrated correctly.
- **Zero-flag rate** (health metric, not a target to move). Tracks whether the
  severity filter is still discriminating (ADR-0008).
- **Flag dismissal rate** (quality signal). Expected to be nonzero by design under
  ADR-0006 — a flag the reader reads and dismisses as "not a problem for me" is
  the cost of favoring recall. A rate that's too high is a signal the confidence
  threshold needs retuning, not proof the approach is wrong.

## Assumptions and risks

- **Willingness to pay is unvalidated.** `research/summary.md` found no first-person
  statement of a price anyone would pay for this category — every price anchor is
  a displaced cost (lawyer fees), not stated demand. Decision made 2026-09-07 to
  proceed to this PRD without closing that gap first; it is the first thing to
  validate once there's something to test against real freelancers.
- **The underlying evidence is secondhand.** Pain points are drawn from lawsuit
  coverage, news stories, and one competitor's own blog — no first-person forum or
  interview data was obtained (`research/summary.md` §5.5). Treat the clause
  ranking in that document as directional, not measured, outside of the
  FTC/CFPB-sourced items (auto-renewal, arbitration, late fees).
- **Extraction fidelity is a correctness concern, not a convenience.** Whatever the
  in-browser parser produces is the text every citation points at; a parser bug
  surfaces as a citation bug (ADR-0001).
- **Hedging vocabulary is unbounded.** See the build-blocking open item under
  capability 2.
- **Regulatory posture is not neutral.** The FTC's Feb 2025 action against DoNotPay
  penalized AI-legal-substitute claims made without attorney-validated output.
  Positioning copy ("know what you're signing") is a compliance surface, not just
  marketing (`research/summary.md` §3.4, ADR-0003).

## Open items before build

- Define the hedging vocabulary bound (ADR-0007).
- Decide the zero-flag-rate baseline that counts as healthy (ADR-0008).
- Decide whether soft/firm counter-offer text is pre-generated per flag or
  generated lazily on stance switch (ADR-0009).
- Decide how a red line violation affects a flag's severity or existence
  (capability 5, above).
- Decide whether gaps get any drafted remedy in v1, or stay flag/question-only
  (capability 3, above).
