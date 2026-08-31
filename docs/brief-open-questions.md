# Redline brief — where this stopped

The brief for `PRD.md` is part-written. Decisions made so far are recorded as ADRs and
in `CONTEXT.md`; this file holds only what is still open, so a later session can pick up
without rereading the conversation that produced them.

Last worked: 2026-08-31.

## Settled (see the ADRs, don't re-litigate here)

- **Segment** — freelancers and independent contractors. Job-seekers explicitly not served. ADR-0002.
- **Reader, not generator** — deferred until the reading product finds fit. ADR-0002.
- **Prospective reads only** — the boundary is the signature, not the document's age; renewal reads supported, remedy questions declined. ADR-0003.
- **Severity ranks consequence, not frequency**, plus the dangerous-vs-unusual test. ADR-0004.
- **Gaps are a separate output type from flags** — severity decides position, type decides what an item may claim. ADR-0005.

## Open — four questions, answers not yet given

Each carries the recommendation that was on the table when work stopped. They are
recommendations, not decisions; nothing here has been agreed.

1. **Which error to prefer.** Recommended: accept misses, refuse false positives — the reader carries each flag into a negotiation with a client who pays them, so a wrong flag costs them credibility immediately, while a miss costs a risk they'd have carried anyway. Consistent with ADR-0001's existing recall-for-verifiability trade.

2. **How confident the output sounds when the model isn't.** Recommended: ban hedging vocabulary outright and express uncertainty by omission — state every flag plainly or don't show it; the question box says "the document doesn't say" rather than reasoning toward a guess. Works only because ADR-0001 makes plain statements checkable.

3. **What a clean document produces.** Recommended: make "this is a normal agreement" a first-class result rather than an empty list, and track the share of documents returning zero flags as a health metric — if it sits near zero in production the severity filter is broken, and nothing else in the product would reveal that.

4. **The counter-offer is a power problem, not a drafting problem.** The freelancer needs the client more than the client needs them, which is why the bad clause is there. Many will read a well-drafted counter-offer, agree with it, and send nothing. Recommended: draft the softest counter-offer that still fixes the clause, and make **counter-offer sent** the primary v1 success metric — a weak ask that gets sent beats a strong one that never leaves the app. No research evidence exists either way; nobody surveyed whether freelancers who spotted a bad clause actually asked to change it.

## One unresolved contradiction

Round two asked whether a missing clause could be presented as a flag when severe
enough. The answer given was "decide it to be gap or flag based on intensity."

ADR-0005 implements that as *severity decides position, type decides claims* — a severe
gap can outrank a mild flag in the same list, but still cannot claim a source sentence,
because ADR-0001 treats an uncitable flag as a bug.

**If the intent was that intensity converts a gap into a citation-free flag, ADR-0001
needs an explicit amendment.** Leaving the two documents to disagree quietly is the one
outcome to avoid. This was flagged and not yet answered.

## Method note

These decisions came out of a structured interview, ten questions across three rounds,
where each question forced a choice between two things that couldn't both be had. That
shape is worth keeping if the brief is picked up again — the value was in the questions
that named what was being given up, not in the ones that gathered requirements.
