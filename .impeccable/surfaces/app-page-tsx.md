---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["lib/sample-agreement.ts"]
---

# Landing page

## Scope and mode

The public landing page at the site root. Mode: Persuade.

## Audience, job, action

- **Visitor:** the PRD reader, a freelancer or independent contractor about to sign an agreement a client sent them.
- **Belief to earn:** Redline ranks the clauses that could cost them, and every flag shows the exact sentence it came from, so they can check it themselves.
- **One action:** try it on a document. It opens the no-account try (#19). A visitor gets the summary and ranked flags, and nothing is stored unless they sign up.

## Proof and content

- A synthetic freelance services agreement, labelled as a sample wherever it could be mistaken for a real one. Its flags are authored and verified word for word against its text by a test.
- No prices, customers, testimonials, quotes, benchmarks, or claims the scope excludes. Nothing about a verdict on signing, legal advice, scanned or photographed documents, or other document types.
- One plain line beside the action: Redline shows what the document says and doesn't give legal advice.
- All copy goes through the humanizer skill.

## Unresolved

- #19 isn't built, so the try action has no working destination yet.
- There's no sign-in entry for returning readers, because the brief allows one action.

## Direction contract

THESIS: The landing page is the sample agreement opened in review mode, with each flag a comment card directly under the sentence it came from. It refuses the category's headline beside a floating dashboard screenshot.

OWN-WORLD: Tracked Changes. A white page on a cool grey canvas #C9CFD8, ink #1C1E22. Markup crimson #B3122E belongs only to the flag in focus; every other flag rests in grey #E7EAEE. Contract text in Tinos, cards and interface in Schibsted Grotesk. A fixed change-bar gutter is the layout grid, and rank numbers hold fixed slots in it. Depth comes from overlap alone: no shadows, gradients, pills, or badges.

STORY: The visitor sees a realistic client agreement flagged worst first, reads flag 1 against its own sentence, and trusts that they can check Redline. Then they try it on their own agreement.

FIRST VIEWPORT: A thin nav strip with the wordmark left and the try action right. Above the page: the headline at display scale, the try action, and the legal-advice line. Below: the labelled sample page, with ranks 1–6 in its left gutter and flag 1's sentence highlighted, its change bar lit, and its comment card open beneath. All of it sits above the fold at 1440×900. Signature interaction: choosing a rank moves the crimson focus. Its sentence highlights, its card opens under it with one short ease-out, and the previous card folds back to grey.

FORM: Inline Comments, dealt lead at position 6 of 6 grounded structures. World seed c02c95d9; surface seed 3baa62e8.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
