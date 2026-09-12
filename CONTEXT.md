# Redline

Redline reads a document someone is about to be bound by and tells them what it
actually says. This glossary fixes the words we use for the things in that job.

## Language

**Red line**:
A term the reader has decided in advance they will not accept. Authored by the reader, persists across documents, and drives the analysis.
_Avoid_: preference, rule, requirement

**Flag**:
A clause Redline identifies as capable of harming the reader. Always bound to a source sentence.
_Avoid_: issue, warning, finding, risk

**Source sentence**:
The exact, verbatim sentence in the uploaded document that a flag is derived from.
_Avoid_: citation, quote, excerpt, reference

**Counter-offer**:
Replacement language drafted for a single flagged clause. Never a whole agreement.
_Avoid_: redline (the verb), edit, suggestion

**Prospective read**:
Reading a document to inform a signature that has not happened yet. The only kind of read Redline performs.
_Avoid_: pre-signature check, review

**Renewal read**:
A prospective read of an agreement the reader has already signed, done to prepare the terms of the next one. The document is in the past; the signature is in the future.
_Avoid_: historical review, audit

**Gap**:
A term the agreement does not contain but should, given what the reader is agreeing to. Has no source sentence, because there is no sentence.
_Avoid_: missing clause, omission, absence

**Severity**:
What a flag or gap costs the reader if it fires. Not how often it fires.
_Avoid_: priority, score, risk level

**Severity threshold**:
The severity a flag or gap has to reach before the reader is shown it at all. One named constant, `SEVERITY_THRESHOLD`, and the clean read is defined as nothing reaching it.
_Avoid_: cutoff, minimum score, noise filter

**Remedy question**:
A question about what the reader can do now about an agreement already in force. Out of scope, and answered as such.
_Avoid_: legal advice, dispute question

**Stance**:
The reader-selected posture — soft or firm — that determines how strongly a counter-offer pushes back on a flagged clause. Chosen per flag; defaults to soft.
_Avoid_: tone, aggressiveness, mode

**Clean read**:
The result when a document produces no flags and no gaps above the severity threshold. A first-class outcome, not an empty state. In code it is `CleanRead`, a branded type only a read whose every stage finished can produce, so a failed analysis cannot render as one.
_Avoid_: no issues found, empty result, no findings

**Textual ambiguity**:
A source sentence whose own wording carries two readings that differ in what the reader is agreeing to. The only thing that licenses hedged wording on a flag, and separate from how sure the analysis is that the clause harms the reader. In code it is `textualAmbiguity` plus the `ambiguity` the readings and the hedge travel in.
_Avoid_: uncertainty, low confidence, vagueness

**Hedge**:
The wording Redline shows under a flag whose source sentence reads two ways, built from both readings so the reader can check it against the sentence. Never used for doubt about courts, enforcement or consequences.
_Avoid_: caveat, disclaimer, qualifier
