# Pasted text is an accepted input alongside upload

Status: accepted

A reader can paste an agreement's text instead of uploading a PDF or Word file. Upload
stays the recommended path and the one the product leads with. Confirmed 2026-09-11,
while briefing the app shell.

## Why this doesn't weaken ADR-0001

Every source sentence is verified against the stored document text, not against the
original file, which is never stored. Pasted text becomes that stored text directly, so
a flag on a pasted agreement meets exactly the same verbatim check as one on an upload.
Nothing about the citation rule needs an exception.

## Considered options

- **Upload only**, as issue #2 was first written. Superseded by this decision.

## Consequences

- **Upload is recommended because paste hands fidelity to the reader.** Uploads go
  through pdf.js or mammoth. Pasted text is whatever the reader's clipboard held, and
  copying out of a PDF viewer can break lines, drop hyphens, or reorder columns. A flag's
  source sentence will match the pasted text exactly and still read differently from the
  file the reader will sign. The input step should say so plainly.
- **Paste is text only.** A pasted screenshot or image is refused, since reading one
  would need OCR, which stays excluded.
- **Two input paths to build and test.** Both must produce the same stored-text shape, so
  `analyzeDocument` never needs to know which path was used.
