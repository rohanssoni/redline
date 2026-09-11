---
version: 1
slug: "app-app-layout-tsx"
primary_target: "app/(app)/layout.tsx"
related_targets: []
---

# App shell (signed in)

## Scope and mode

The frame a signed-in reader works in. Mode: Operate. This is a brief only; no app screen is built yet. The screens inside it are built by #2, #3, #4, #6, #8, #9, #10, #13, #14, #15, #18, and #20.

## Task, content, and states

- **New document:** upload a PDF or Word file (recommended), or paste the text (ADR-0020). The input step says upload gives the most faithful source sentences. Pasted images and scanned or photographed documents are refused with a reason.
- **Result:** the plain-English summary, then flags and gaps in one list ranked by severity. Every flag shows its source sentence; a gap never does. A document with nothing above the threshold gets the clean read as its own result, never an empty list.
- **Per flag:** a soft counter-offer, a switch to firm (drafted on demand, with a visible loading state), copy, and dismiss.
- **Question box:** answers only from the document. When the text doesn't cover something, it says so. It declines remedy questions and requests to draft wording for a gap, and gives the reason.
- **Red lines:** the reader's own list, which they can add to, edit, and delete from. It applies to every document.
- **Library:** past documents, reopened without a new model call, and deletable.
- **States to design:** analysing; analysis failed (never shown as a clean read); firm draft loading or failed; question declined; no red lines yet; empty library; a document saved from a no-account try.
- **Frequency:** repeat use across many documents. Speed of checking a flag against its sentence matters more than first-run delight.

## Unresolved

- Where dismissed flags go, and whether they can be restored.
- Whether red lines are edited on their own screen or in a panel beside the result.
- Whether questions and answers are saved with the document. The spec doesn't say.
- What's in the account menu.

## Direction contract

THESIS: The signed-in frame is a review workspace: the reader's summary and ranked flags sit beside their own document page, with the question box docked at the page's foot. It refuses a dashboard of cards, scores, and charts.

OWN-WORLD: Tracked Changes, the same world as the landing page and DESIGN.md. A white page on canvas #C9CFD8, ink #1C1E22. Markup crimson #B3122E marks only the flag in focus; every other flag rests in grey #E7EAEE. Document text in Tinos, interface in Schibsted Grotesk. The change-bar gutter is the grid, ranks hold fixed slots, and depth comes from overlap alone: no shadows, gradients, pills, or badges.

STORY: The reader opens a document and reads the summary. Then they work down the flags worst first, check each against its highlighted sentence, and pick a stance or dismiss. They ask what the document says, and they come back to the library later.

FIRST VIEWPORT: A top bar on the strip holds the wordmark, New document, Library, Red lines, and the account. The left half, on canvas, has the summary and below it the ranked flags and gaps. The focused flag opens in place with its counter-offer and stance switch. The right half has the page, scrolled to the focused flag's sentence with its change bar lit, and the question box docked beneath it. A clean read replaces the flag list with its own result. On narrow screens the halves become Summary, Flags, Document, and Ask tabs, and choosing a flag jumps to Document at its sentence. Signature interaction: choosing a flag on the left scrolls the page to its sentence and moves the crimson focus, the same focus grammar as the landing page.

FORM: Summary and Page, dealt lead at position 4 of 6 grounded structures. World seed c02c95d9; surface seed 96d41ff4.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
