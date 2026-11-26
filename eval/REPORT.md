# Eval report

This is what I measured about Redline's analysis, how I measured it, and what the
numbers do and don't tell me. Every figure comes from a file in this repository, and
each section names the file.

## What the product does

Redline reads an agreement someone is about to sign and tells them what it says. In
this version the reader is a freelancer or independent contractor looking at an
agreement a client sent them (`PRD.md`). The reader uploads a PDF or Word file, which
is parsed in the browser, or pastes the text. Only the text is stored.

The output is a plain-English summary and a list of flags ranked by severity. A flag
is a clause that could hurt the reader, and it always shows the exact sentence it came
from. The pipeline checks that sentence against the document text before it shows the
flag, and a flag that fails the check is not shown at all. Each flag also gets a
drafted counter-offer, and there is a question box that answers only from the
document.

The PRD doesn't promise a list of clause types by name. What it promises is a test,
from ADR-0004: a clause is worth flagging when it lets the other side change the
reader's economics on its own after the reader is committed. A clause that is unusual
but binds both sides the same way is dropped. A document with nothing above the
severity threshold gets a "clean read" result.

## What I measured

`npm run eval` reads a gold set of nine documents through the same pipeline the
product uses, against the real model, and counts three things (`eval/README.md`):

- **Recall.** Of the planted clauses in scope, how many came back as a flag the reader
  would see. A planted clause counts as found when a shown flag quotes a span that
  overlaps it. Whether the flag also named the right clause type is a second number.
- **Groundedness.** Of every flag the model returned, before any filter, how many
  quote a sentence that is in the document character for character. The citation check
  means a reader never sees a flag that fails this, so it measures how often the model
  copies the quote correctly.
- **Clean documents.** How many flags appear on the three documents that should come
  back clean.

The run I'm reporting is `eval-runs/2026-10-30T16-48-37Z`, read with
`z-ai/glm-5.3-flash` through OpenRouter, with no red lines. It scored all nine
documents and no model call failed. The two runs before it scored nothing, because
OpenRouter rejected the API key as expired. The record of this run is committed on the
branch `fix-renewals-and-quotes` (commit `471354d`), not on this branch.

### The documents

Six documents have planted clauses and three are benign (`eval/gold-set/corpus/README.md`):

| Document | Planted clauses |
|---|---|
| Gym membership and instructor certification (`adhesion-contract`) | 9 |
| Consumer software subscription (`saas-subscription`) | 8 |
| Consumer wireless service agreement (`phone-plan-terms`) | 7 |
| Self storage unit rental (`storage-unit-rental`) | 6 |
| Offer of employment (`offer-letter`) | 5 |
| Summer analyst internship (`internship-agreement`) | 5 |
| Community garden plot licence (`clean-document`) | benign |
| Library volunteer arrangement (`library-volunteer-agreement`) | benign |
| Swimming lesson registration (`swim-lesson-registration`) | benign |

That is 40 planted clauses across seven types. The gold set also marks seven
sentences as unusual but harmless.

### What is in scope

Six of the seven types are in scope, which leaves 35 planted clauses to count:
unilateral modification (6), fee escalators and late fees (9), auto-renewal (6),
non-compete (4), limitation of liability (4) and indemnification (6).

Arbitration and class-action waivers (5 clauses) are out of scope. They move no money
and no obligation, and all five in the gold set send a dispute to arbitration whichever
side brings it, which is the symmetric kind of clause the PRD says to drop. A missed
arbitration clause is never counted as a miss. This is the most arguable call in the
eval, and `eval/README.md` (decision 6) says how to reverse it.

## Results

All from `eval-runs/2026-10-30T16-48-37Z.txt`.

### Recall

- Planted clauses found: **31 of 35**.
- Found and named the right type: **29 of 35**.

By type:

| Type | Found | Named right |
|---|---|---|
| Unilateral modification | 6 of 6 | 5 of 6 |
| Fee escalators and late fees | 9 of 9 | 8 of 9 |
| Auto-renewal | 3 of 6 | 3 of 6 |
| Non-compete | 4 of 4 | 4 of 4 |
| Limitation of liability | 3 of 4 | 3 of 4 |
| Indemnification | 6 of 6 | 6 of 6 |

Three of the four misses are auto-renewal clauses. Two of the four misses came back
from the model but were dropped by the citation check, because the quote didn't match
the document:

- The gym contract's liability cap. The model typed a straight apostrophe in
  "Meridian's" where the document has a curly one.
- The phone plan's renewal clause. The model left out the words "at the end of the
  term then running," from the middle of the sentence.

The other two misses never came back at all. Both are renewals worded as the agreement
"continuing" rather than "renewing": the software subscription's monthly billing
period and the storage unit's month-to-month term.

The out-of-scope arbitration clauses were flagged anyway: **5 of 5**.

### The character split

The gold set puts characters a model tends to retype into some planted sentences: curly
quotes, non-breaking spaces, ligatures, em dashes and double spaces.

- Sentences with no special character: **23 of 26** found.
- Sentences with at least one: **8 of 9** found.

Within that second group: curly quote or apostrophe 2 of 3, non-breaking space 1 of 2,
fi or fl ligature 4 of 4, em dash 1 of 2, two spaces in a row 1 of 1. The counts are
too small to separate the groups. The one miss in the special-character group is the
liability cap above, and it was lost to a retyped apostrophe.

### Groundedness

- Flags the model returned that quote the document exactly, after the whitespace
  normalisation the pipeline uses: **63 of 65**.
- The same, against the file before normalisation: **61 of 65**.
- Flags shown to the reader that quote the document exactly: **62 of 62**.

The two that failed are the two dropped flags described under recall. The last line
should always be 62 of 62, because it's what the citation check guarantees.

### Clean documents

- Benign documents with no flags shown: **0 of 3**.
- Flags shown on benign documents: **5** (2 on the garden licence, 1 on the library
  volunteer agreement, 2 on the swimming registration).
- Benign documents given the clean read: **0 of 3**. Each of the three also got 3
  gaps.
- Unusual-but-harmless sentences flagged: **2 of 7**. They are the offer letter's
  signing-payment clawback and the internship's charge for unreturned equipment.

## My labels

The eval can tell me whether a flag landed on a planted clause. It can't tell me
whether a flag is right. So I labelled ten shown flags from the same run by hand
(`eval/labels/`). The ten were picked to be the ones the eval says least about: every
one matched no planted clause, and they are spread across all nine documents.

The rule: **PASS** if the quoted sentence really is the kind of clause the flag names
and really costs the reader something. Otherwise **FAIL**.

My labels: **10 of 10 PASS** (`eval/labels/labels.json`).

I changed my mind four times, all on one flag: flag 5, the library volunteer's duty
to keep borrower records confidential. It went PASS, FAIL, PASS, FAIL, and ended on
PASS. I left no notes on any label.

## The judge

I wrote a rubric from that rule and the PRD (`eval/judge/rubric.md`) and had a fresh
model, which saw only the rubric and the flags, judge the same ten. I ran it twice
with identical input.

How far the judge agrees with me, against my final labels:

- Run 1: **10 of 10**.
- Run 2: **9 of 10**.

Both runs disagreed with me on flag 5 at the time they ran. Run 1 passed it while my
label was FAIL, and run 2 failed it after I had changed my label to PASS. With the
input unchanged, the judge gave opposite verdicts on that flag. Its reason for passing
it in run 1 was that the rubric counts "something they now have to do or may not do"
as a cost.

All ten of my labels are PASS, so these numbers only show that the judge agrees with
me when I pass a flag. I have no FAIL label for it to agree or disagree with, and its
agreement on FAILs is 0 of 0.

On every flag shown in the run, the judge passed **57 of 62**
(`eval/judge/all-flags-run-1.json`). The five it failed were the gym contract's
authority to draw payments, the software subscription's no-refund-on-cancellation, the
storage unit's allocation of payments to the oldest debt, the library confidentiality
clause, and the swimming registration's rule that a parent watches from the gallery.
Nine of my ten flags are among the 62, and it passed all nine. The tenth, flag 5, it
failed again.

## The fix on `fix-renewals-and-quotes`

Two commits go after the misses described under recall. They are on their own branch,
`fix-renewals-and-quotes`, and are not merged yet. Every result above is from before
them.

- `730e05d` makes the citation check read the curly quote marks ‘ ’ “ ” as ' and " on
  both sides before it compares. The reader still sees the document's own span, and a
  missing, added or different mark still fails. ADR-0021 is amended to say so.
- `471354d` tells the flag stage that a term which carries the reader into another
  period by itself, at a price the other side sets, is a renewal, whether it says
  renews, continues, rolls over or extends.

I ran the eval twice with both changes together (`eval-runs/2026-11-01T16-12-50Z` and
`eval-runs/2026-11-01T16-15-52Z`, committed on that branch). The figures come from the
two commit messages:

| | Before (`16-48-37Z`) | After, run 1 | After, run 2 |
|---|---|---|---|
| "Continues" renewals found | 0 of 2 | 1 of 2 | 2 of 2 |
| Auto-renewal recall | 3 of 6 | 5 of 6 | 5 of 6 |
| Recall | 31 of 35 | 33 of 35 | 32 of 35 |
| Named the right type | 29 of 35 | 31 of 35 | 31 of 35 |
| Groundedness | 63 of 65 | 58 of 58 | 64 of 65 |
| Clean documents | 0 of 3 | 0 of 3 | 0 of 3 |
| Limitation of liability | 3 of 4 | 4 of 4 | 4 of 4 |

What the table doesn't show:

- The quote-mark change decided no flag in either run. Every quote the model returned
  carried the document's own quote marks. Limitation of liability went to 4 of 4
  because the model copied the apostrophe correctly, not because of the change.
- The one quote dropped in run 2 lost an "fi" ligature, which the change doesn't cover.
- Run 2 missed the gym contract's plain "renews automatically" clause (P-01), which the
  before run caught. That is why auto-renewal stays at 5 of 6.
- Two runs can't separate the change from run-to-run noise.

## Limits

**A model wrote the gold set.** The clauses are hidden the way a model knows how to
hide them and worded the way a model recognises. Every number here is an upper bound
on how the analysis does on real contracts, and none of them belongs in anything a
reader sees.

**The gold set isn't the product's segment.** The PRD serves freelancers reading a
client's agreement and doesn't accept consumer terms of service. None of the nine
documents is a freelancer's client agreement, and three of them are consumer
agreements (gym, software subscription, phone plan).

**The counts are small.** Non-compete and limitation of liability have four clauses
each, so one clause moves either rate by a quarter. There are three benign documents.

**Ten labels is a start.** They are one person's labels, all PASS, with no notes, and
four changes of mind on one flag. They can't show whether the judge catches a bad
flag, and they don't cover any flag that matched a planted clause.

**One run before the fix, two after.** The results are from one scored run. The only
other scored runs are the two after the fix, and they ran with different code. So I
haven't measured how much the numbers move between runs of the same model on the same
documents, and two runs can't separate the fix from run-to-run noise. The two after
runs already differ from each other: recall was 33 of 35 in one and 32 of 35 in the
other.

## What I would fix next

The quote-mark fix and the renewal fix already exist on `fix-renewals-and-quotes`
(see above), so they aren't listed here. I will do the two remaining fixes in this
order.

1. **Benign documents that never come back clean.** I'm doing this first. All three
   benign documents came back with flags, and a reader sees that directly. This has to
   move clean documents from 0 of 3 toward 3 of 3, and benign flags from 5 toward 0,
   without recall dropping below 31 of 35.

   I think the gaps on benign documents also need to change, and I will confirm that
   before I change anything. In a later run, the library volunteer agreement came back
   with 0 flags and still got no clean read, because it had 4 gaps. That suggests gaps
   alone block the clean read. That later run (`eval-runs/2026-11-26T15-07-01Z`) read
   only three documents and is not the scored run.
2. **Labels that can test the judge.** I'm doing this second. I need more labelled
   flags, including ones I fail and ones that matched a planted clause, and a written
   note on flag 5 that settles whether a duty that costs nothing counts. Until I fail
   some flags myself, the judge's FAIL agreement is 0 of 0, so I can't trust its 57 of
   62 yet.
