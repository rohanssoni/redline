# Severity ranks consequence, not frequency

Status: accepted

Severity is what a flag or gap costs the reader if it fires, not how likely it is to
fire. Anything implausible for the document at hand is dropped entirely rather than
ranked low.

## Why

The two-factor alternative — cost multiplied by likelihood — sounds more rigorous but
produces a middle-of-the-list ordering nobody can explain. The reader has to justify
each flag to a paying client in a live negotiation, so the ranking has to survive being
read aloud. "This could cost me the rights to my own work" is an argument a freelancer
can make; "this scored 6.4" is not.

## What makes a clause dangerous rather than merely unusual

A clause is dangerous when **it lets the other side change the reader's economics
unilaterally after the reader is committed.** Unlimited revisions, net-90 terms with no
late fee, termination for convenience with no kill fee, unilateral scope amendment, and
IP assignment reaching beyond the delivered work all pass this test.

Non-standard but symmetric language does not. An unusual governing-law choice or an odd
notice address is a deviation from a template, not a danger. Flagging every deviation
turns Redline into a diff and trains the reader to ignore it.

## Consequences

- Redline will feel quiet about the everyday friction freelancers complain about most — small recurring fee and timing annoyances rank low by design.
- Plausibility filtering happens before ranking, so a dropped clause never appears at all. If readers report missing things, the filter is the first place to look, and it is invisible in the output by construction.
