# Flags favor catching risk over avoiding false alarms

Status: accepted

When a clause has a source sentence to cite but the model isn't certain it's actually
harmful, Redline still shows it as a flag. This is a different axis from ADR-0001's
citation rule: ADR-0001 asks "can we point at the sentence this came from," and answers
no by dropping the flag entirely. This decision asks "are we sure this citable clause is
actually dangerous," and answers by flagging anyway rather than staying silent.

## Alternatives

- **Refuse to flag unless confident, accept more misses.** The recommendation on the
  table going into this decision: a wrong flag costs the reader credibility with a
  client in a live negotiation, while a missed risk costs something they'd have carried
  anyway. Rejected because the flag's citation already gives the reader a free way to
  check it — they read the sentence themselves and dismiss what doesn't hold up. A miss
  offers no such recovery: it never appears, so the reader has no way of knowing they
  should have looked closer.

## Why

ADR-0001's citation requirement is normally framed as a floor for trust. Here it doubles
as the safety net for this decision: because every flag is independently verifiable,
showing a borderline one costs the reader a few seconds of judgment, not blind trust.
That asymmetry only holds because citations are mandatory — without ADR-0001 this would
be the wrong call.

## Consequences

- Expect flags the reader reads and dismisses as "not actually a problem for me." That
  is working as intended, not a defect — measure the dismissal rate rather than treating
  it as noise to suppress.
- ADR-0004's plausibility filter still runs first — an implausible clause is dropped,
  not flagged with low confidence. This decision only governs clauses that already
  passed that filter and already have a citation.
