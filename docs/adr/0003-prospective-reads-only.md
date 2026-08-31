# Redline performs prospective reads only

Status: accepted

Redline reads a document to inform a signature that has not happened yet. It does not
tell a reader what to do about an agreement already in force. When someone uploads a
signed document, Redline still summarises it and still flags its clauses — it simply
does not answer remedy questions, and says why.

The line is the signature, not the document's age. A **renewal read** — uploading an
expiring or already-signed agreement to prepare the terms of the next one — is
prospective and fully supported, because the reader is deciding what to sign next.
"They haven't paid me, what are my options" is a remedy question and is declined, even
though the same document may be attached.

## Why

Remedies require jurisdiction, limitation periods, and an assessment of the reader's
position — that is practising law, and it is the exact claim the FTC's February 2025
order against DoNotPay penalised, where an "AI lawyer" was marketed without attorneys
validating its output. Staying prospective keeps Redline's central promise ("we state
only what the document says", per ADR-0001) defensible rather than aspirational.

## Consequences

- We decline at the moment of highest motivation. Someone already harmed is more willing to pay than someone about to sign; we are choosing not to sell to them.
- The distinction is not visible in the document itself. Two identical uploads differ only by what the reader asks, so the boundary has to be enforced at the question, not at ingest.
- "Redline does not give legal advice" becomes a product behaviour with a testable edge, rather than a disclaimer in a footer.
