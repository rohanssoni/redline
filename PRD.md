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
does explicitly. **Confirmed 2026-09-07: v1 does not accept consumer terms of
service as input at all**, even though nothing in `CLAUDE.md`'s settled-decisions
list forbids it by name (ADR-0017). Two independent reasons converge on this.
First, ADR-0002 already scopes the reader to freelancers negotiating with clients —
a ToS is not that. Second, `research/summary.md` §5.2 found the best-evidenced
clause harms (auto-renewal, arbitration waivers) live in take-it-or-leave-it
consumer ToS with no counter-offer to draft, while a free competitor (ToS;DR)
already covers the major services. Building for ToS would mean building the one
capability — counter-offers — that doesn't apply there.

**Known, accepted gap:** only 28% of freelancers use a contract for any given gig
(ADR-0002). Redline reads documents; the 72% without one get nothing from v1. Not a
defect — generating an agreement is deferred until the reading product finds fit.

## Scope

The six capabilities below, the two ways a document gets in, the landing page, and
trying a document without an account, and nothing else. When a feature idea doesn't
appear here, it needs a decision before it gets built, per `CLAUDE.md`.

### Getting a document in

The reader uploads a PDF or Word file, parsed in the browser, and only the extracted
text is sent or stored (`CLAUDE.md`, settled). Upload is the recommended path and the
one the product leads with.

The reader can paste the agreement's text instead (ADR-0020). Pasted text is stored and
checked exactly like extracted text: it is the text every source sentence is verified
against. Because a paste can garble line breaks or column order, the input step says
plainly that upload gives the most faithful source sentences.

Scanned or photographed documents are refused on both paths, including an image pasted
in place of text. There is no OCR.

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

Hedging is bounded to one trigger: genuine ambiguity in the source sentence's own
wording, and nothing else (ADR-0010). Low confidence for any other reason — e.g.
how a court would treat the clause — either produces a plainly-stated flag or gets
dropped under ADR-0004's plausibility filter; it never produces hedged wording,
because the reader has no way to check a hedge that isn't about the sentence
itself.

A reader's own **red line** overrides the plausibility and confidence filters
entirely: a clause matching a red line always produces a flag, never silently
dropped for being implausible or low-confidence (ADR-0013). It still needs a
citable source sentence like any other flag — the override applies to filtering,
not to ADR-0001's citation requirement.

**Clean read:** a document with no flags or gaps above the severity threshold
returns a dedicated "this reads as a normal agreement" result — a first-class
outcome, not an empty list (ADR-0008). The production zero-flag rate is tracked as
a health metric against a provisional baseline of 20% (ADR-0011) — a placeholder to
watch for drift against until real production data replaces it, not a validated
target. The comparison stays fixed against that 20% until a switchover point, then
becomes a rolling window instead; the switchover fires at whichever comes first —
**500 analyzed documents, or 90 days since launch** — so a fast-adopting product
isn't stuck on the placeholder longer than needed and a slow-adopting one still
switches once enough calendar time has passed (ADR-0016).

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

Only the soft version is drafted at analysis time; the firm version for a flag is
generated on-demand the moment the reader switches that flag to firm, not before
(ADR-0012) — most flags are expected to stay at the default, so this avoids paying
for a firm draft most readers never see, at the cost of a short wait on switch.

Gaps get no drafted remedy in v1 — no counter-offer, no filler clause language,
even for a high-severity gap (ADR-0014). This leaves the single best-evidenced
freelancer pain in the research (an absent late-payment clause) flagged but
unresolved by v1; drafting language to fill an absence has no anchor in the
document at all, which is generation, not reading, and stays deferred alongside
ADR-0002's decision to defer agreement generation entirely.

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

**"What should I put here instead" is also declined for a gap.** Since gaps get no
drafted remedy (capability 3, ADR-0014), a question asking Redline to draft filler
language gets the same decline-and-explain treatment as a remedy question, not an
improvised answer.

### 5. Editable red line list

The reader authors and edits a list of **red lines** — terms decided in advance as
unacceptable. This list persists across documents and drives the analysis: a
clause matching a red line always surfaces as a flag, bypassing the plausibility
filter (ADR-0004) and confidence threshold (ADR-0006) that would otherwise apply —
the reader's own prior decision replaces that judgment for this one clause
(ADR-0013). It still needs a citable source sentence like any other flag; the
override is on filtering, not on ADR-0001's citation rule.

Matching is semantic, not literal: a clause triggers the override when the model
judges it violates the intent of the red line, even if phrased nothing like how the
reader wrote it (ADR-0015). A client's contract rarely echoes a reader's own
wording, so requiring literal overlap would make the override rarely fire; the
flag's citation remains the safety net if a semantic match turns out to be a
stretch.

Match quality is checked with an LLM-as-judge — a second model call reviews
whether a match reasonably fits the red line's intent — rather than a
human-labeled test set (ADR-0018). This trades some rigor for scaling
automatically to whatever a reader writes — treat its output as a
review-priority signal, not proof of correctness, since it shares the same
blind spots as the model it's checking.

When the judge disagrees with a match, the flag still renders exactly as it
would otherwise — no suppression, no confidence marker shown to the reader.
The disagreement is logged for review instead (ADR-0019). Holding the flag
back would break ADR-0013's guarantee that a red line is never silently
dropped; a visible confidence marker would stretch ADR-0010's hedging bound
to a kind of uncertainty — match quality, judged by a second model — the
reader has no way to verify.

### 6. Saved library of past documents

Past analyses are saved and browsable. Only the extracted text is stored — never
the original uploaded file (`CLAUDE.md`, settled). This is what makes the red line
list and renewal reads useful across sessions rather than per-upload.

### Landing page

A public page for the reader named above. It demonstrates one thing: a sample
agreement turning into ranked flags, each showing the exact sentence it came from. It
offers one action: try it on a document.

The sample agreement is synthetic and labelled as a sample wherever a visitor could
mistake it for a real contract. Its flags quote its own sentences word for word and are
held to ADR-0001 exactly like real output.

The page claims nothing the scope excludes: no verdict on whether to sign, no legal
advice, no scanned or photographed documents, and no document types beyond a
freelancer's client agreement. One plain line next to the action says Redline shows
what the document says and doesn't give legal advice. It uses the real product name
and carries no prices, customers, testimonials, or quotes. Its copy goes through the
humanizer skill like all other user-facing copy (`CLAUDE.md`).

### Trying a document without an account

The landing page's action lets a visitor try one document without signing in. They get
the plain-English summary and the severity-ranked flags and gaps, with every flag's
source sentence, or the clean read. Counter-offers, the question box, red lines, and
the library need an account. An anonymous analysis runs with no red lines.

- **Nothing is stored.** The text stays in the browser tab. It is sent with the analysis
  request and verified within it, but never written to the database.
- **Signing up keeps it.** A visitor who signs up in the same tab gets the text and its
  analysis saved to their library, without calling the model again. Leaving the tab
  first loses it, and the result says so.
- **It is limited.** Anonymous analyses are capped per IP per day, and documents have a
  maximum length, both enforced server-side with Supabase. No new service or dependency
  is involved. The exact numbers are not decided.

## Explicitly out of scope

Payments, billing, OCR for scanned documents, and sharing a document between
users — see `CLAUDE.md` for why. Consumer terms of service — see "Who this is
for," above, and ADR-0017. Anonymous access to counter-offers, the question box, red
lines, or the library. A CAPTCHA or other third-party bot check on the no-account try.

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
  threshold needs retuning, not proof the approach is wrong. Track red-line-
  triggered flags separately from ordinary ones (ADR-0013) — a reader dismissing
  their own stated red line is a different signal than dismissing a borderline
  flag the model raised on its own.

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
- **Regulatory posture is not neutral.** The FTC's Feb 2025 action against DoNotPay
  penalized AI-legal-substitute claims made without attorney-validated output.
  Positioning copy ("know what you're signing") is a compliance surface, not just
  marketing (`research/summary.md` §3.4, ADR-0003).

## Open items before build

- **No-account limits.** The per-IP daily limit and the maximum document length for
  the no-account try are not chosen.
- **Positioning has no ADR.** `PRODUCT.md` records "alongside a lawyer" (confirmed
  2026-09-11). That is a different argument from the cost-of-a-lawyer framing in
  `research/summary.md` and the spec's problem statement.

Everything else raised across this PRD's drafts is resolved — ADR-0001 through
ADR-0020.
