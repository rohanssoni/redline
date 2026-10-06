# Text that is not an agreement is refused, and the summary call decides it

Status: accepted

A text that is plainly not an agreement of any kind is refused rather than read. The
summary call decides it: its schema carries a `readsAsAnAgreement` boolean beside the
summary, and when that comes back false the read stops with a reason the reader can
read. No flag, gap or red line stage runs, no clean read is produced, and nothing is
counted towards the zero-flag rate.

The prompt leans towards reading. Any agreement is still read, including a lease,
terms of service, an employment contract and one in another language. Only text with
no terms in it, such as a recipe or an article, is refused.

## Alternatives

- **Show the summary with a note instead of refusing.** Needs a new result shape, a
  change to both review screens, the stored analysis and the kept try, and a summary
  of a recipe is of no use to the reader.
- **A separate classification call before the summary.** Adds a model call, and one
  more way for a read to fail, to every read, and decides nothing the summary call
  cannot decide in the same reply.
- **A keyword check with no model call.** Easy to fool, and it refuses real
  agreements written in another language.

## Why

The clean read says what a document contains: nothing that lets the other side change
the reader's terms, and none of the usual terms missing (ADR-0008). A text with no
clauses produces no flags and no gaps, so without this check it reached the clean read
and was told it holds four terms it does not hold. `CLAUDE.md` forbids a claim the
text does not support. Nothing else in the read asked whether the text was an
agreement, and the summary call reads the whole text first, so a boolean in its schema
costs no extra call and saves the later ones.

## Consequences

- A refused text costs one model call. In the no-account try it still uses one of the
  day's reads, because the read is claimed before any model call. Whether a refused or
  failed read should count is being decided separately.
- The refusal is an `AnalysisError`, so both routes show its message with the status
  they already give one.
- ADR-0017 is still not enforced. Consumer terms of service read as an agreement here
  and are analysed like any other. Enforcing ADR-0017 is a separate decision.
- The decision is the model's. A real agreement it wrongly calls something else is
  refused, which is why the prompt says to read when in doubt.
