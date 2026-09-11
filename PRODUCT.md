# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Settled in `CLAUDE.md`, not open: Next.js, Supabase for auth and database, deployed on Vercel. The model is called through OpenRouter. Uploaded files are parsed in the browser with pdf.js and mammoth. Vitest is the approved test runner. No application code exists yet; the first build ticket is GitHub issue #2.

## Users

Freelancers and independent contractors who have been sent an agreement by a client and have to decide whether to sign it (ADR-0002). They can't justify roughly $400 for a lawyer to review every agreement, and they don't have the training to tell whether a clause puts them at risk, whether a protection is missing, or how to push back.

The same reader comes back: the saved library and the red line list only pay off with repeat use. A reader preparing to renew an agreement they already signed is also in scope (renewal read).

Not served in v1: job-seekers, renters, small landlords, creators, and anyone reading consumer terms of service (ADR-0002, ADR-0017). The 72% of freelancers who work without a contract get nothing from v1, and that gap is accepted.

## Product Purpose

Redline reads an agreement someone is about to be bound by and tells them what it actually says. For v1 that is six capabilities, and nothing else without a decision (`CLAUDE.md`, `PRD.md`):

1. A plain-English summary.
2. Flags and gaps in one list ranked by severity, with every flag showing its source sentence.
3. A counter-offer for each flag, in a stance (soft or firm) the reader picks per flag.
4. A question box that answers only from the document.
5. The reader's own editable red line list, which drives the analysis.
6. A saved library of past documents.

Success is a counter-offer that actually gets sent, split by stance. The zero-flag rate and the flag dismissal rate are health signals, not targets.

## Positioning

Redline works alongside a lawyer, not instead of one. It helps a freelancer understand an agreement and prepare before a lawyer review, so the paid time goes further. It never presents itself as legal advice or as a substitute for a lawyer. The FTC's February 2025 order against DoNotPay makes that a compliance line, not a tone preference (ADR-0003, `research/summary.md` §3).

What a neighbouring product can't truthfully copy: every flag shows the exact sentence it came from, checked word for word against the reader's own document before it's displayed. A flag that can't show its source sentence is never shown (ADR-0001). Competing AI review tools are criticised for mistakes that need vigilant checking. Redline's claim is that the reader can check every flag in seconds without trusting the tool.

## Operating Context

- The reader gets the agreement from a client, usually by email, as a PDF or Word file. Scanned documents aren't supported; OCR is excluded on purpose.
- They read it on phone and desktop equally. Neither is secondary.
- They check a flag by reading its source sentence, decide whether it matters to them, and either dismiss it or take the counter-offer back to the client.
- Counter-offers leave the product by being copied into the reader's own reply. Copying is how "sent" is measured.
- The file never leaves the browser. Only the extracted text is stored.

## Capabilities and Constraints

Terminology is fixed by `CONTEXT.md`: red line, flag, source sentence, counter-offer, prospective read, renewal read, gap, severity, remedy question, stance, clean read. Use those words and avoid the synonyms that file lists.

Behaviour that shapes every surface:

- A flag always shows its source sentence. A gap never claims one and is labelled as a gap (ADR-0001, ADR-0005).
- A flag hedges ("this could allow…") only when its source sentence is itself ambiguous (ADR-0010).
- A document with nothing above the severity threshold gets a clean read, a first-class result rather than an empty list (ADR-0008).
- Counter-offers default to soft. Firm is drafted on demand when the reader switches a flag, so there is a visible wait (ADR-0009, ADR-0012).
- Gaps get no drafted wording (ADR-0014).
- The question box says "the document doesn't say" rather than guessing. It declines remedy questions and requests to write wording for a gap, and it says why (ADR-0003, ADR-0014).
- A red line match always produces a flag, even when the usual filters would drop it (ADR-0013).

Excluded on purpose: payments, billing, pricing, OCR, and sharing documents between users.

Open decisions:

- The accessibility standard hasn't been set.
- Willingness to pay is unvalidated, and there is no pricing.
- This positioning, alongside a lawyer, was confirmed on 2026-09-11 and has no ADR yet.

## Brand Commitments

- The name is Redline. No logo, wordmark, or domain exists yet.
- Voice rule from `CLAUDE.md`: all copy a user reads has to be run through the humanizer skill before it's committed, including the landing page, UI labels, error messages, and empty states. Copy that reads as model-written is a defect.
- State only what the document says. This applies to summaries, severity rankings, counter-offers, and answers alike.
- No copy may imply legal advice or that Redline replaces a lawyer.

## Evidence on Hand

- `research/summary.md` and its four source files contain the market and pain research. It is secondhand: news coverage of lawsuits, regulator data, and a vendor's blog. No first-person interviews exist.
- The research quotes real people (for example, freelancers on Zoho's blog). Those are third-party sources about the problem, not Redline users, and must never appear as Redline testimonials.
- `PRD.md`, `CONTEXT.md`, and ADR-0001 through ADR-0019 in `docs/adr/` are the product record. The v1 spec is GitHub issue #1, and its build tickets are #2–#16.

Absent, and not to be fabricated: users, testimonials, customer logos, accuracy benchmarks, usage numbers, press, pricing, a logo, and a domain.

## Product Principles

1. **Every claim can be checked against the document.** If the reader can't verify something by rereading their own agreement, Redline doesn't show it.
2. **Say what the document says, or say nothing.** Declining, or saying the document doesn't cover something, beats a plausible guess.
3. **The reader's judgment drives the product.** Red lines override the model's filtering, and stance is the reader's call per clause.
4. **Prepare the reader; don't replace their lawyer.**
5. **Trust over breadth.** A capability that makes the analysis less trustworthy stays out, however useful it looks.
