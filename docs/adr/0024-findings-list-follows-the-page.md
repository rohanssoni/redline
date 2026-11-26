# The findings list follows the page by default, and lines up with it

Status: accepted. Amends ADR-0005.

Both review screens, the try and a saved document, show the findings list beside the
marked-up page. By default the
list is in **document order**: flags in the order their source sentences appear on
the page, then gaps. Each flag in that list carries its **severity band** (High,
Medium or Low), and its number is its place on the page. A **Worst first** switch
puts the list back in severity order, where the number is the rank again. Picking a
finding **lines it up**: the page scrolls until the flag's source sentence, or the
gap's note at the foot of the page, sits level with its entry in the list, and a line
joins the two. Hovering an entry draws the same line without scrolling. Picking a
marked sentence on the page selects its entry in the list.

## What this changes in ADR-0005

ADR-0005 says severity governs order, so a high-severity gap can sit above a
low-severity flag in the same list. That still holds in the Worst first order. In
the default order, place on the page governs instead, and severity is shown by the
band rather than by position. A gap has no place on the page, so every gap comes
after every flag in the default order, whatever its severity. ADR-0005's other
rule is untouched: type governs what a finding may claim, and neither order turns a
gap into a flag.

Severity ranking itself does not change. ADR-0004 still decides each finding's
severity, the severity threshold still decides what is shown, and the rank is still
computed for every read. Only the default order of the list changes.

## Considered options

Three ways of keeping the list and the page in step were built and compared on one
real read of a test agreement. The prototype is kept at commit [`0cd05ec`](https://github.com/rohanssoni/redline/tree/0cd05ec/app/prototype/flag-sync), under `app/prototype/flag-sync/`:

- **Follow along.** The list stays in the margin. Picking an entry centres its
  sentence on screen, and the entry for the sentence being read is marked as the
  reader scrolls. The list and the page are joined only by that marker, so the
  reader still has to look from one to the other to match them.
- **Line up.** Chosen. The sentence is brought level with the entry that named it,
  so the reader sees the pair side by side with a line between them.
- **Step through.** The list folds into a bar pinned to the top of the page with
  Previous and Next. It hides the list the reader came to see, and puts the whole
  list one click away.

For the order, worst first was the default in all three variants until the
document-order switch was added to Line up.

## Why

Lining up scrolls the page on every pick. In worst-first order, reading down the
list makes the page jump up and down the document, and the line points up on one
pick and down on the next. In document order the list and the page run the same way,
so reading down the list moves down the page, and each finding is seen next to the
text around it. That is how a reader reads an agreement.

What document order loses is how bad a flag is, which the number used to say. The
band puts that back on every flag, and Worst first is one click away for a reader
who wants the worst first.

## Consequences

- A high-severity gap sits at the foot of the default list, below every flag. A
  reader who stops reading before the foot does not see it in the default order.
- Copy that promises "worst first" (landing page, try page, document page, sample
  review) describes the switch, not the default. It has to change, and the new copy
  goes through the humanizer skill like any other.
- The number beside a finding means two things: its place on the page in the
  default order, its rank in Worst first. The mark on the sentence uses the same
  number as the list, so the two always agree in whichever order is shown.
- Scope item 2 in `CLAUDE.md` says the flags are "ranked by severity". They still
  are: every flag has a rank and a band, and the ranked order is one click away. It
  is no longer the order the reader sees first.
