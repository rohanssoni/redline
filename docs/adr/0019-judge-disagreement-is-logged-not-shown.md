# Red-line judge disagreement is logged, not shown or gated

Status: accepted

When the LLM-as-judge (ADR-0018) disagrees with a semantic red-line match, the flag
still renders exactly as it would without the disagreement — no confidence marker, no
suppression. The disagreement is logged for review, not surfaced to the reader.

## Alternatives

- **Hold the flag back when the judge disagrees.** Rejected: ADR-0013 guarantees a red
  line match always produces a flag, precisely so the reader's own stated priority is
  never silently dropped by a downstream check. Letting a second model's disagreement
  override that would recreate the exact silent-drop failure mode ADR-0013 exists to
  prevent — treating a check ADR-0018 itself calls "not proof of correctness" as if it
  were one.
- **Show the flag with a lower-confidence marker.** Rejected: ADR-0010 already drew the
  line on what a flag may signal uncertainty about — ambiguity in the sentence itself,
  which the reader can verify by rereading the quote. A match-quality marker sourced
  from a second model's opinion is a different, unverifiable kind of uncertainty, and
  reintroduces exactly the ungroundable signal ADR-0010 was written to keep out.

## Why

Logging preserves ADR-0013's guarantee untouched and doesn't stretch ADR-0010's hedging
boundary to cover a kind of uncertainty it wasn't designed for. It also directly feeds
the one use ADR-0018 already named for this signal: a periodic audit trigger, watching
whether the disagreement rate runs suspiciously low or high.

## Consequences

- The reader never sees judge disagreement — a red-line flag looks identical whether the
  judge agreed or not. All the value of the check is realized after the fact, not in the
  moment.
- Someone has to own watching the disagreement log and act on the audit signal named in
  ADR-0018 — an operational responsibility, not decided further here.
