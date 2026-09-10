# Redline v1: full-scope spec

Local mirror of [GitHub issue #1](https://github.com/rohanssoni/redline/issues/1)
(`ready-for-agent`). The issue is the source of truth — this file is a snapshot
from 2026-09-09 and will go stale if the issue is edited on GitHub without this
file being re-synced.

---

## Problem Statement

A freelancer or independent contractor receives an agreement from a client and has to decide whether to sign it. They don't have a lawyer's budget (~$400 per review) or a lawyer's training to tell whether a specific clause puts them at risk, whether something that should protect them is missing, or how to push back on what they find. So they either sign as-is and carry risk they can't see, or pay for a review most of them can't afford. Freelancers are hit hard by this: over half report client non-payment, with an average disputed amount over $6,000.

## Solution

Redline reads an uploaded agreement — parsed entirely in the browser, so only the extracted text is ever stored, never the original file — and gives the reader: a plain-English summary; a single severity-ranked list of risky clauses (flags) and missing protections (gaps), where every flag shows the exact sentence it came from so the reader can check it themselves without trusting the tool blindly; a drafted counter-offer for each flagged clause, in a tone (soft or firm) the reader picks per clause based on how much leverage they actually have with that client on that term; a question box that answers strictly from the uploaded document and declines to give advice about a dispute that's already happened; a persistent, editable list of the reader's own "red lines" — terms they've already decided they won't accept — that always gets flagged when violated, regardless of what the model's own judgment would otherwise do; and a saved library so this builds up across documents instead of resetting on every upload.

## User Stories

1. As a freelancer, I want to upload a contract file (PDF or Word) and have it parsed entirely in my browser, so that the original file never leaves my device and only the extracted text is stored.
2. As a freelancer, I want a plain-English summary of the agreement, so that I understand what I'm signing without reading dense legal language myself.
3. As a freelancer, I want risky clauses in the document flagged, so that I know where I might get hurt.
4. As a freelancer, I want every flag to show me the exact sentence it's based on, so that I can verify the finding myself without trusting the tool blindly.
5. As a freelancer, I want flags ranked by what they'd cost me if triggered, not by how often that kind of clause shows up elsewhere, so that the most dangerous risks are at the top of the list.
6. As a freelancer, I want an unusual-but-symmetric clause (like an odd governing-law choice) left out of the list entirely, rather than shown as a low-severity flag, so the list doesn't train me to ignore it the way a diff tool would.
7. As a freelancer, I want a citable clause flagged even when the tool isn't fully certain it's harmful, so that I don't miss a real risk just because the model played it safe.
8. As a freelancer, I want a flag to say plainly "this could allow..." only when the sentence itself is genuinely open to two readings, so that every hedge I see is something I can personally check by rereading the quote.
9. As a freelancer, I don't want a flag to hedge for any reason other than the sentence's own wording (e.g. uncertainty about how a court would rule), so a hedge never means "trust me, I'm not sure" with nothing to check it against.
10. As a freelancer, I want to see protections the agreement should have but doesn't — like a late-payment clause — even though there's no sentence to point at, so I know what to ask the client to add.
11. As a freelancer, I want gaps and flags ranked together in one list by severity, so a severe missing protection can outrank a minor flagged clause.
12. As a freelancer, I never want a gap shown as if it had a source sentence, no matter how severe it is, so I never confuse "this is missing" with "this is what it says."
13. As a freelancer, I want to be told plainly when my document reads as a normal, low-risk agreement, so a lack of flags feels like good news, not like the tool failed.
14. As a product owner, I want the rate of documents returning zero flags tracked against a baseline, so I can tell if the severity filter breaks and starts silently suppressing everything.
15. As a freelancer, I want a drafted counter-offer for every flagged clause, so I have something concrete to send back instead of starting from scratch.
16. As a freelancer, I want a counter-offer to rewrite only the flagged clause, never the whole agreement, so I'm not presenting my client with unrelated changes.
17. As a freelancer, I want a counter-offer never to argue for terms the document doesn't actually contain, so what I send stays grounded in what was actually flagged.
18. As a freelancer, I want to choose whether a counter-offer is soft or firm, per clause, so I can match my ask to how much leverage I actually have with this client on this specific term.
19. As a freelancer, I want every counter-offer to default to soft, so I don't accidentally send an aggressive ask on a clause where I have no real leverage.
20. As a freelancer, I want to switch a single flag's counter-offer to firm and get a redraft for that flag, so I can use my leverage exactly where I know I have it.
21. As a freelancer, I don't want to wait for every possible tone of every counter-offer to generate up front, so my analysis finishes quickly — I only wait when I actually ask for the firmer version of a specific flag.
22. As a freelancer, I want no drafted counter-offer for a gap, so I'm never handed fabricated clause language with nothing in the document behind it.
23. As a freelancer, I want to ask questions about my document in plain language, so I don't have to hunt through it myself.
24. As a freelancer, I want an answer built only from what the document actually says, so I'm never misled by a plausible-sounding guess.
25. As a freelancer, I want to be told "the document doesn't say" when the text doesn't support an answer, so I know exactly where Redline's knowledge of my situation ends.
26. As a freelancer, I want Redline to decline questions about what I can do about a dispute that's already happened, and tell me why, so I'm not relying on it for legal advice it isn't positioned to give.
27. As a freelancer preparing to renew an agreement I've already signed, I want to ask what to negotiate differently this time, so I can use what happened last time to improve the next contract.
28. As a freelancer, I want Redline to decline a request to draft filler language for something missing, and say why, rather than improvise an answer, so I'm never handed invented legal text.
29. As a freelancer, I want to build a persistent list of my own "red lines" — terms I've already decided I won't accept — so my own stated priorities, not just the model's judgment, drive what gets caught.
30. As a freelancer, I want a clause that violates one of my red lines to always show up as a flag, even if it would otherwise be filtered out as too minor or too uncertain, so my own stated priority is never silently missed.
31. As a freelancer, I want a red line to match a clause by its real meaning, not by matching my exact wording, so a client's differently-phrased version of the same term doesn't slip past my own rule.
32. As a freelancer, I still want a red-line-triggered flag to show its exact source sentence, so I can verify it exactly like any other flag.
33. As a freelancer, I want my past analyses saved in a library, so I can look back at earlier agreements without re-uploading them.
34. As a freelancer, I want only the extracted text of a document saved, never the original file, so my actual documents aren't sitting on someone else's server.
35. As a freelancer, I want my red line list to persist across every document I analyze, so I don't have to redefine my own priorities each time.
36. As a product owner, I want to track how often a counter-offer actually gets sent, split by soft vs. firm, so I know whether the product helps freelancers negotiate rather than just producing drafts nobody uses.
37. As a product owner, I want to track how often a flag gets dismissed by the reader, with red-line-triggered flags tracked separately from ordinary ones, so I can tell whether the confidence threshold or the red-line matching needs retuning.
38. As an engineer running the eval, I want an automated second-model check on every semantic red-line match, so questionable matches surface for review without a person hand-labeling every one.
39. As a product owner, I want a judge's disagreement with a match logged rather than shown to the reader or used to suppress the flag, so the "a red line is always flagged" guarantee stays intact while still building a signal for periodic audits.

## Implementation Decisions

**Seams** (agreed with the user before writing this spec — the three model-calling boundaries, kept separate because they fire at genuinely different times):

- **`analyzeDocument(text, redLines) → { summary, flags[], gaps[] }`** — the core seam, called once per uploaded document. Internally:
  - Applies the dangerous-vs-unusual plausibility filter before ranking; an implausible clause is dropped entirely, never shown at low severity (ADR-0004).
  - Verifies every flag's quoted source sentence against the input text verbatim before it can be included in the output — a flag that fails this check is dropped, not shown with an approximate or missing quote (ADR-0001; this verification is itself the required correctness test for this seam).
  - Favors recall: a citable clause with only partial confidence is still flagged (ADR-0006).
  - Applies calibrated hedging to flag wording, but only when the trigger is genuine ambiguity in the source sentence's own wording — never for any other kind of uncertainty (ADR-0007, ADR-0010).
  - Applies the red-line override: a clause whose meaning matches a red line (semantic match, not literal — ADR-0015) always produces a flag, bypassing the plausibility filter and the confidence threshold, but never bypassing the citation check (ADR-0013).
  - Runs a second, independent model call (LLM-as-judge) against each red-line-triggered match; disagreement is logged for later audit, never shown to the reader and never used to suppress or mark down the flag (ADR-0018, ADR-0019).
  - Returns a dedicated clean-read result when nothing clears the severity threshold, rather than an empty list (ADR-0008). Emits/increments the zero-flag-rate metric, compared against a fixed 20% baseline for the first 500 analyzed documents or 90 days since launch (whichever comes first), then against a rolling window (ADR-0011, ADR-0016).
- **`draftCounterOffer(flag, stance) → text`** — `stance` is `'soft' | 'firm'`. Called once per flag at analysis time with `stance: 'soft'`. Called again, on-demand, the instant a reader switches a specific flag to `'firm'` — never pre-generated (ADR-0009, ADR-0012). Anchored to the one clause it rewrites; never argues for terms the document doesn't contain (inherits ADR-0001's grounding constraint). Not called for gaps under any circumstance (ADR-0014).
- **`answerQuestion(text, question) → { answer } | { declined: true, reason }`** — independent of `analyzeDocument`, invoked whenever the reader asks something. Constrained to the document text; states plainly or declines — no hedging here, unlike a flag, since a question has no citation of its own to hedge against (ADR-0007's plain-or-omit principle still applies to this seam specifically). Declines, with a stated reason, any remedy question (about a dispute that's already happened) and any request to draft filler language for a gap (ADR-0003, ADR-0014). A renewal read — the same document, a forward-looking question about the next agreement — is answered normally; the boundary is the question asked, not the document's age.

**Supporting modules** (CRUD/storage, not seams in the testing sense above):

- Client-side parser (pdf.js / mammoth, already-approved dependencies) extracts text in-browser; only the extracted text is ever transmitted or stored, never the original file (settled in `CLAUDE.md`).
- Document store: extracted text plus its most recent analysis result, per reader, browsable as the saved library (capability 6).
- Red line store: the reader's persistent, cross-document list of red lines (CONTEXT.md: **Red line**) — editable, and read by `analyzeDocument` on every run.
- Auth via Supabase, gating the library and red line list to the signed-in reader.
- All three seams call the model via OpenRouter (settled in `CLAUDE.md`).
- A judge-disagreement log (feeds ADR-0018's periodic-audit signal and the flag-dismissal-rate split in the Success Metrics).

**Not specified here, needs a decision before implementation** — see Further Notes: how a consumer ToS is technically distinguished from an in-scope document, since ADR-0017 states the boundary but not an enforcement mechanism.

## Testing Decisions

- A good test here exercises a seam's external contract — text/red-lines/question in, structured output out — never the prompt wording or the sequence of internal model calls. Fixture inputs and either recorded model responses or a fake model client conforming to the same interface; no live model calls in the test suite.
- Modules to test: `analyzeDocument`, `draftCounterOffer`, `answerQuestion`, independently of each other, the DB, and the UI.
- Tests the PRD/ADRs specifically require, by name:
  - Every flag's source sentence is found verbatim in the fixture document text; a flag that fails this must not appear in the output at all (ADR-0001) — this is the correctness test for the whole flagging feature, not an edge case.
  - A gap never carries a source sentence and never appears in the `flags` array, at any severity (ADR-0005).
  - A red-line match still produces a flag against a fixture engineered to otherwise fail the plausibility filter or confidence threshold (ADR-0013).
  - Hedged wording appears only on a fixture built around genuine sentence-level ambiguity, and never on a fixture built around some other kind of low confidence (ADR-0010).
  - A remedy-question fixture and a gap-fill-request fixture are both declined with a stated reason, never answered (ADR-0003, ADR-0014).
  - Immediately after `analyzeDocument`, only the soft counter-offer exists for a flag; the firm one is absent until `draftCounterOffer(flag, 'firm')` is called (ADR-0012).
- Prior art: none — this is the first spec for a greenfield codebase, so there's no existing test pattern in this repo to follow. The seams above are shaped specifically to make each of these behaviors testable in isolation.

## Out of Scope

- Payments, billing, OCR for scanned documents, sharing a document between users (`CLAUDE.md`).
- Consumer terms of service as an input type (ADR-0017).
- Any drafted remedy language for a gap (ADR-0014).
- Generating a new agreement from scratch, for the 72% of freelancers who work without a contract at all — deferred, not rejected (ADR-0002).
- Any segment other than freelancers/independent contractors: job-seekers, renters, small landlords, creators (ADR-0002).
- A human-labeled test set for red-line matching quality — named in ADR-0018 as a future periodic audit, not part of this build.
- Re-deriving or tuning the specific numbers already decided (the 20% baseline, the 500-document/90-day switchover) — used as given (ADR-0011, ADR-0016).

## Further Notes

- **ADR-0017 has no stated enforcement mechanism.** It says v1 "does not accept" consumer ToS as input, but nothing in the PRD or ADRs specifies how the system would actually recognize a ToS at upload time to reject or redirect it. As written, this reads as a product-positioning and design boundary (what Redline is built and marketed for), not a technical gate — worth resolving explicitly before implementation, since building an actual classifier would be new, undecided scope.
- **The confidence-signal mechanics are an implementation-level design question**, not resolved at the spec level: ADR-0006 (recall over precision) and ADR-0010 (hedging triggered only by sentence-level ambiguity) both assume the model can distinguish "textual ambiguity" from "other uncertainty" as separate signals. How that distinction is actually produced (structured output fields, a separate classification pass, prompting alone) is left to whoever implements `analyzeDocument`.
- **Willingness to pay is unvalidated**, and much of the underlying pain-point research is secondhand rather than first-person (see `PRD.md`'s Assumptions and risks). This spec builds the product as scoped; it does not resolve that validation gap, which remains the first thing to check once there's something real to test against freelancers.
- **Regulatory posture is not neutral.** FTC precedent against AI-legal-substitute claims made without attorney-validated output constrains product copy and disclaimer design (ADR-0003). Not a functional requirement captured elsewhere in this spec, but worth a design/legal pass before ship.
