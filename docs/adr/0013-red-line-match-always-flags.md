# A red line match always produces a flag

Status: accepted

When a clause in the document matches one of the reader's red lines, it is shown as a
flag regardless of what ADR-0004's plausibility filter or ADR-0006's confidence
threshold would otherwise decide. A red line match is never silently dropped.

## Alternatives

- **A red line match boosts severity but still passes through the same filtering as any
  other flag.** Rejected: `CONTEXT.md` defines a red line as authored by the reader and
  driving the analysis. A red line that can still be filtered out contradicts "drives" —
  the reader's own stated priority would then depend on the same plausibility judgment
  applied to everything else, which is exactly the judgment the red line was meant to
  bypass.

## Why

The point of the red line list is that the reader decided in advance what they won't
accept — that decision already carries all the plausibility judgment a general clause
would otherwise need the system to infer. Filtering it through the standard pipeline
would mean the reader's own list is worth less than the model's guess.

## Consequences

- A red-line-triggered flag still needs its citable source sentence — ADR-0001 has no
  exception. A red line overrides the plausibility and confidence filters, not the
  citation requirement; a match with no findable sentence still doesn't render.
- Matching a red line to a clause is itself a judgment call (exact term only, or
  something the model decides is "close enough"?) that isn't specified here and needs
  its own decision before build.
- Expect the flag-dismissal metric (ADR-0006) to read differently for red-line-triggered
  flags than ordinary ones — consider tracking them separately, since a reader
  dismissing their own stated red line is a different signal than dismissing an ordinary
  borderline flag.
