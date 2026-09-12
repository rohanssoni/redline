# 0021 — Verbatim means whitespace-insensitive, and nothing else

Status: accepted

## Decision

The verbatim check of ADR-0001 compares a quoted source sentence with the document
text after collapsing every run of whitespace to a single space **on both sides**.
Nothing else is normalised: a changed letter, a changed case, a changed, added or
removed punctuation mark, and an added or dropped word all fail the check and the
flag is dropped.

The sentence that is stored and shown to the reader is always the span cut out of
the **document**, never the model's version of it. Where the two differ in
spacing, the reader sees what their document says.

## Alternatives

- **Byte-for-byte comparison.** The strictest reading, and the one we wanted. It
  drops real flags: a PDF breaks a sentence wherever the page broke it, so the
  same sentence arrives with a newline where the document has a space, and a
  model that copies it correctly still fails.
- **Fuzzy or edit-distance matching.** Recovers those flags and everything else
  too, including the tidied-up quote that ADR-0001 exists to catch. A fabricated
  quote and a real one stop being distinguishable, which is the whole failure.
- **Normalising punctuation as well, such as curly quotes to straight.** Every
  extra normalisation widens what counts as "the same sentence", and the tidied
  quote is exactly the case that sits inside that widening.

## Why

Line breaks are the parser's, not the document's. Punctuation and wording are the
document's. Collapsing whitespace forgives what the parser did and forgives
nothing the model did, which is the line ADR-0001 draws.

## Consequences

- A quote whose only difference is spacing is kept, and displayed in the
  document's own spacing.
- The check is a substring test, so a quote that is a fragment of a longer
  sentence passes. It is still the document's words, and it is still findable by
  the reader in their own document.
- `normalizeDocumentText` already settles the stored text in one pass, so the
  text a flag is checked against and the text the reader is shown are the same
  string.
