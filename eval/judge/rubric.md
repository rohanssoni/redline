# Rubric for judging a flag

You are given flags that Redline showed a reader. Each flag names a clause type and
quotes one sentence from an agreement, with the paragraph around it. Judge each flag
on its own against this rubric, and nothing else.

## The rule

**PASS** if the quoted sentence really is the kind of clause the flag names and really
costs the reader something. Otherwise **FAIL**.

Both halves have to hold. A sentence that costs the reader something but isn't the
kind of clause the flag names is a FAIL. So is a sentence that is the kind of clause
the flag names but costs the reader nothing.

## Who the reader is

From `PRD.md`:

> Redline reads a document someone is about to be bound by and tells them what it
> actually says.

The reader is the person being asked to sign. "The other side" is the party that
wrote the agreement.

## What a flag is, and the clause types

`PRD.md` doesn't define clause types by name. Each flag names its own type in a few
plain words, and the first half of the rule asks whether the quoted sentence is a
clause of that type, in the ordinary meaning of the words the flag uses. Read the
sentence in its paragraph. The paragraph can show what the sentence refers to, but the
sentence is the one being judged.

What the PRD says a flag is:

> **Flag** — a clause capable of harming the reader.

And what it says separates a clause worth flagging from one that is merely unusual:

> Use the dangerous-vs-unusual test from ADR-0004: a clause that lets the other side
> change the reader's economics unilaterally after the reader is committed is
> dangerous; a non-standard but symmetric clause is not, and gets dropped rather than
> ranked low.

## What "costs the reader something" means

The PRD measures cost by consequence:

> **Severity** ranks what the item costs the reader if it fires, not how often it
> fires (ADR-0004).

A sentence costs the reader something when, if what it allows happens, the reader
ends up worse off: money paid or lost, a right given up, or something they now have to
do or may not do. How likely that is doesn't matter. Whether it happens is enough.

## Edge cases

None are settled yet. The labeller's notes are empty, so there is nothing to turn into
a general rule.

## Not part of the rule

- **Severity.** The flag's number is shown, but whether it is too high or too low
  doesn't change PASS or FAIL.
- **Whether the quote is in the document.** Code already checks that every quoted
  sentence appears in the agreement word for word. Take the quote as given.
- **Enforceability.** Whether a court would uphold the clause, and what the law
  somewhere requires, are not part of the rule.

## What to return

For each flag, its number, PASS or FAIL, and one sentence on why.
