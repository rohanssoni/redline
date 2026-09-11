---
name: Redline
description: A client's agreement opened in review mode, with every flag pinned under the sentence it came from.
colors:
  markup: "#b3122e"
  markup-wash: "#f7dfe3"
  ink: "#1c1e22"
  ink-hover: "#383c43"
  ink-soft: "#3a3f47"
  ink-muted: "#50565f"
  canvas: "#c9cfd8"
  canvas-deep: "#b7bec9"
  strip: "#e7eaee"
  page: "#ffffff"
  comment: "#eef0f3"
  rest: "#e7eaee"
  rest-line: "#9aa2ad"
typography:
  display:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "clamp(2.125rem, 1rem + 2.6vw, 2.875rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "clamp(1.625rem, 1.1rem + 1.6vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  lede:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  action:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.5
  action-compact:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.5
  wordmark:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 800
    letterSpacing: "-0.02em"
  rank-numeral:
    fontFamily: "Schibsted Grotesk, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 800
    fontFeature: "tnum"
  doc-title:
    fontFamily: "Tinos, Times New Roman, serif"
    fontSize: "1.375rem"
    fontWeight: 700
    letterSpacing: "0.01em"
  doc-heading:
    fontFamily: "Tinos, Times New Roman, serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.4
  doc-body:
    fontFamily: "Tinos, Times New Roman, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
  sm: "4px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "32px"
  gutter: "72px"
  gutter-narrow: "44px"
  column: "760px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    padding: "12px 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-compact:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    typography: "{typography.action-compact}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "40px"
  button-compact-hover:
    backgroundColor: "{colors.ink-hover}"
  button-text:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "6px 0"
  nav-strip:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.ink}"
    typography: "{typography.wordmark}"
    padding: "8px 16px"
  rank-index-item:
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-small}"
    padding: "5px 0"
  rank-index-item-active:
    textColor: "{colors.ink}"
  document-page:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.doc-body}"
    rounded: "{rounded.none}"
    padding: "22px 52px 32px 72px"
    width: "min(760px, 100% - 32px)"
  page-label:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    padding: "6px 72px"
  clause-toggle:
    textColor: "{colors.ink}"
    typography: "{typography.doc-heading}"
    padding: "3px 0"
  flag-sentence-rest:
    backgroundColor: "{colors.rest}"
    textColor: "{colors.ink}"
    typography: "{typography.doc-body}"
  flag-sentence-focus:
    backgroundColor: "{colors.markup-wash}"
    textColor: "{colors.ink}"
  gutter-rank-rest:
    textColor: "{colors.ink-muted}"
    typography: "{typography.rank-numeral}"
    size: "28px"
  gutter-rank-focus:
    textColor: "{colors.markup}"
  comment-card:
    backgroundColor: "{colors.comment}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "12px 18px 13px 20px"
  gap-note:
    backgroundColor: "{colors.comment}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "12px 18px"
  close-panel:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "40px 72px 44px"
---

# Design System: Redline

## Overview

**Creative North Star: "Tracked Changes"**

Redline looks like a document someone has marked up for review. A white page lies on a cool grey canvas. The agreement's own words are set in a document serif, and everything Redline says is set in a grotesk and placed beside or under those words. Nothing floats above the page. Flags are marks on the page itself: a change bar in the gutter, a highlight behind the sentence, a rank numeral in a fixed slot, and a square comment card opened directly beneath the sentence.

Only one flag holds focus at a time, and only that flag turns crimson. Every other flag stays visible in resting grey, so a reader can see how much is marked without the page shouting. Choosing a flag moves the crimson: its sentence takes the wash, its change bar lights, its card unfolds under it with a single ease-out, and the previous card folds back to grey. That focus move is the reusable signature. Any surface that shows a flag against its source sentence uses it.

Density matches a real agreement. Text is set close, rules are hairlines, and the only rounded object is the one filled action. Depth comes from paper stacked on paper and from marks that overlap the page edge. There are no shadows, gradients, pills, or badges.

**Key Characteristics:**
- A white page on a cool grey canvas, with a pale strip for chrome and labels.
- Two typefaces with separate jobs: Tinos for document text, Schibsted Grotesk for Redline's own words.
- A fixed change-bar gutter on the page's left edge is the layout grid. Rank numerals and change bars live in it.
- One crimson focus at a time. Every other flag rests in grey.
- Square paper forms, hairline and dotted rules, flat surfaces.
- Short, single-curve ease-out folds that open in place and never leave the page.

## Colors

Cool paper greys and near-black ink, with a single markup crimson reserved for whatever currently has the reader's attention.

### Primary
- **Markup Crimson** (markup): The flag in focus and nothing else. It colours that flag's change bar, gutter rank numeral, comment leader and the comment card's top rule, plus the underline on its entry in the rank index. At 6.9:1 on the white page it holds up as text for the rank numeral.
- **Markup Wash** (markup-wash): The highlight behind the focused flag's source sentence, with ink text on top (13:1). It always appears together with Markup Crimson and never without it.

### Neutral
- **Review Ink** (ink): Headlines, document text, focused index entries, the filled action, the wordmark's change bar, the focus ring, and the text-selection background.
- **Pressed Ink** (ink-hover): The filled action's hover state. It is not used anywhere else.
- **Soft Ink** (ink-soft): Secondary Redline text such as the lede, notes beside the action, section body copy, resting rank-index entries, labels and hedges. It stays at 6.7:1 even on the canvas.
- **Muted Ink** (ink-muted): The quietest text, used for resting gutter rank numerals, clause flag counts and the italic party line under the document title. It sits on the white page only (7.4:1).
- **Review Canvas** (canvas): The full-bleed ground everything sits on. It is also the scrollbar track.
- **Canvas Rule** (canvas-deep): Hairline dividers on the canvas. It separates rank-index entries and below-page list rows and draws the strip's bottom edge.
- **Chrome Strip** (strip): The sticky navigation strip and the label band across the head of the page.
- **Paper** (page): The document page, the closing panel, and text on the filled action.
- **Comment Grey** (comment): The fill for comment cards and gap notes.
- **Resting Highlight** (rest): The highlight behind a flagged sentence that isn't in focus, and the hairline at the page foot. It has the same value as Chrome Strip but a different job. Keep them as separate tokens.
- **Resting Mark** (rest-line): Resting change bars, the dotted rules under clause headings, dotted comment leaders, and the resting top rule on comment cards and gap notes. It reaches only 2.6:1 on white, so it is for marks only and never for text.

### Named Rules
**The One Focus Rule.** Crimson belongs to the flag in focus and to nothing else. The wordmark, the action, headings, links and hover states stay ink. If two things on screen are crimson, they must be the same flag.

**The Resting Grey Rule.** A flag out of focus keeps its marks in grey (Resting Highlight behind the sentence, Resting Mark for the bar and rules) and never disappears. Focus changes a flag's colour, not whether it is there.

## Typography

**Display Font:** Schibsted Grotesk (with a size-matched Arial fallback from next/font)
**Body Font:** Schibsted Grotesk for interface and commentary; Tinos (with a size-matched Times New Roman fallback) for document text
**Label/Mono Font:** Schibsted Grotesk with tabular figures for rank numerals; no mono face

**Character:** A dense, tightly tracked grotesk speaks for Redline, and a plain metric-compatible Times face stands in for the agreement itself. The contrast between them tells the reader, at a glance, which words are the contract's and which are Redline's.

### Hierarchy
- **Display** (800, fluid 34px to 46px, 1.04, tracked -0.035em, balanced wrap): The one page headline.
- **Headline** (800, fluid 26px to 36px, 1.1, tracked -0.03em, balanced wrap): Section headings on the canvas.
- **Lede** (400, 1.125rem, 1.45; 1.0625rem at 640px and below): The paragraph under the display headline, capped at 66ch.
- **Body** (400, 1.0625rem, 1.5): Section copy and comment card readings. Comment readings tighten to 1.45 line height and cap at 62ch; section copy caps at 58ch to 64ch.
- **Body Small** (400, 0.9375rem): Notes beside the action, rank-index entries, comment hedges, and gap explanations.
- **Title** (600, inherits its context size: 1.0625rem on the page, 0.9375rem in the rank index): Gap statements, the focused rank-index entry, and underlined text toggles.
- **Label** (400, 0.8125rem to 0.875rem): Page label bands, captions, footer text. Clause flag counts use the same size at weight 500.
- **Action** (700, 1.0625rem; compact 0.9375rem): Text on the filled action.
- **Wordmark** (800, 1.1875rem, tracked -0.02em; 1rem in the footer): The name, set beside a 3px ink bar.
- **Rank Numeral** (800, tabular figures, 0.9375rem in the gutter, 0.8125rem for grouped clause ranks): Flag ranks, always in fixed-width slots.
- **Document Title** (Tinos 700, 1.375rem, tracked 0.01em, centred; 1.1875rem at 640px and below): The agreement's title, followed by a centred italic Tinos party line in Muted Ink.
- **Document Heading** (Tinos 700, 1.0625rem, 1.4): Clause headings.
- **Document Body** (Tinos 400, 1.0625rem, 1.5; 1rem at 640px and below): Clause sentences, 6px apart.

### Named Rules
**The Two Hands Rule.** Tinos is only for words quoted from the document: its title, clause headings and sentences. Everything Redline writes, including a comment directly under a Tinos sentence, is Schibsted Grotesk. Never set a reading in the serif, and never set a source sentence in the grotesk.

**The Fixed Slot Rule.** Rank numerals are weight 800 with tabular figures and sit in a fixed-width slot (1.1em in lists, a 28px square in the gutter), so ranks line up in a column however many flags there are.

## Layout

Everything shares one centred column, min(760px, 100% − 32px), on a full-bleed canvas. The sticky navigation strip runs full width, but its padding keeps the wordmark and the action aligned to the column's edges. Below-page sections sit in the same column. Their headings start flush left, and their body text is indented by the gutter (20px at 640px and below). Line lengths are capped between 58ch and 66ch.

The document page is a white sheet filling the column. Its left padding is the gutter: 72px, or 44px at 640px and below. Inside the gutter, rank numerals are centred in a 28px slot 18px from the page edge (6px on narrow screens). A 2px change bar runs 16px left of the flagged sentence (10px on narrow screens), inset 3px top and bottom. Right padding is 52px (18px on narrow screens).

The ranked index moves with the viewport. Below 1280px it sits above the page in a three-column grid, or two columns at 640px and below, with rows divided by Canvas Rule hairlines. From 1280px up it becomes a single 212px column in the canvas margin, 36px left of the page, lined up with the page top. Comment cards hang 104px past the page's right edge above 900px and stay inside the page at 900px and below.

The vertical rhythm is loose but consistent. Sections sit 64px to 88px apart. Blocks inside a section are 12px to 22px apart. Sentences are 6px apart. The page head uses 22px above and 32px below.

**The Gutter Is the Grid Rule.** The gutter width is the unit that aligns the system. Change bars and rank numerals live inside it, label bands bleed through it to the page edge, and body text outside the page indents by it. New surfaces set a flagged document in the same gutter and do not invent a second margin system.

## Elevation & Depth

The system is flat. No surface has a shadow or a gradient. Depth comes from two sources. The first is tonal stacking: Review Canvas at the bottom, Chrome Strip and Comment Grey above it, white Paper on top. The second is overlap. Comment cards extend past the page's right edge onto the canvas, the rank index sits out in the canvas margin, and the label band bleeds to the page's edges. The direction called for depth from overlap alone. The shipped build also relies on tone, and this record follows the build.

### Named Rules
**The Paper Stack Rule.** Lift is shown by a lighter sheet or by overlapping an edge, never by a shadow. If an element seems to need a shadow to separate, give it a lighter paper tone or let it cross an edge.

## Shapes

Paper is square. Every surface, card, band, highlight and rule has sharp corners (0px). The single exception is the filled action, which has barely softened corners (4px). The system has three line types. A 1px solid hairline divides things (Canvas Rule on the canvas, Resting Highlight at the page foot). A 1px dotted line marks something at rest or not yet opened: the rule under a closed clause heading and the leader from sentence to comment. It turns solid on hover and disappears once the clause opens. A 2px solid bar marks review: the change bar, the top rule of comment cards and gap notes, and the active index underline. Each of these turns crimson when its flag takes focus. The wordmark's 3px ink bar borrows the change bar's shape.

**The Square Paper Rule.** Only the filled action is rounded, at 4px. Everything else, cards included, stays at 0.

## Components

Every component is quiet by default and reacts precisely. Keyboard focus on any control is a 2px Review Ink outline with a 3px offset. Selected text is Paper on Review Ink. The system has no inputs, tabs or menus yet. Build those from these tokens and record them the next time this file is regenerated.

### Buttons
- **Shape:** Barely softened corners (4px) on the filled action only.
- **Primary:** Paper text on Review Ink, weight 700 at 1.0625rem, 12px 22px padding, at least 48px tall, never wrapping. There is one of these per view.
- **Hover / Focus:** Background shifts to Pressed Ink over 160ms with the ease-out curve. Focus uses the global ink outline.
- **Compact:** The same button at 40px tall with 8px 16px padding and 0.9375rem text (12px side padding and 0.875rem on narrow screens), used in the navigation strip.
- **Text toggle:** No fill and no border. Weight 600 Review Ink text with an underline offset 0.25em and 6px vertical padding. Used for page-level toggles such as showing the whole document.

### Navigation
- **Style:** A sticky strip in Chrome Strip with a 1px Canvas Rule bottom edge and 8px vertical padding. The wordmark (3px ink bar plus the name) sits at the left edge of the column and the compact action at the right edge.
- **States:** Links inherit ink and use underlines offset 0.2em. There are no active colours, and crimson never appears in the strip.

### Rank Index
- **Style:** An ordered list of flags, worst first. Each row is a full-width, borderless button with a fixed-slot rank numeral and a short Soft Ink label at 0.9375rem, separated by 1px Canvas Rule hairlines. A small Soft Ink caption sits above it.
- **States:** Hover brings the text up to Review Ink. The pressed entry, which is the flag in focus, turns Review Ink at weight 600 and swaps its hairline for a 2px Markup Crimson underline.

### Document Page
- **Corner Style:** Square (0px).
- **Background:** Paper, set in Document Body.
- **Shadow Strategy:** None. See Elevation & Depth.
- **Border:** None. The page's edge against the canvas is the border.
- **Internal Padding:** 22px top, 52px right, 32px bottom, and the gutter on the left. A Chrome Strip label band in 0.8125rem Soft Ink can run edge to edge across the page head. The title and party line are centred beneath it.

### Clause Fold
- **Heading:** A full-width, borderless button in Document Heading, with the clause's flag count at its right as plain grotesk text ("1 flag", "no flags"). A dotted Resting Mark rule runs beneath it.
- **Gutter:** While the clause is closed, its flag ranks sit grouped in the gutter at 0.8125rem Muted Ink. They fade out as the clause opens and the individual sentence ranks take over.
- **Motion:** The body opens in place by animating grid rows from 0fr to 1fr over 280ms on cubic-bezier(0.16, 1, 0.3, 1). The dotted rule fades to transparent over the same curve. Closed bodies are inert.

### Flagged Sentence (signature)
- **Rest:** The sentence sits on a Resting Highlight, cloned across line breaks. A 2px Resting Mark change bar runs in the gutter beside it, and its rank numeral in the 28px gutter slot is Muted Ink, or Review Ink on hover. The comment beneath it is folded shut.
- **Focus:** The highlight becomes Markup Wash, the change bar and rank numeral turn Markup Crimson, and the comment card unfolds under the sentence. All of it runs over 280ms on the same ease-out curve. The previously focused flag folds back and returns to grey at the same moment. When focus moves to a sentence that is off screen, the view scrolls after the fold settles, and it jumps without animation under reduced motion.
- **Reduced motion:** All transition durations drop to 0ms. The state changes still happen.

### Comment Card
- **Corner Style:** Square (0px).
- **Background:** Comment Grey, with a 2px top rule in Resting Mark that turns Markup Crimson when its flag is focused.
- **Leader:** A 12px dotted vertical line, inset 20px, connects the card to the sentence above it and changes colour along with the top rule.
- **Content:** The reading in Body (Review Ink, 62ch cap). An optional hedge follows in Body Small Soft Ink, 6px below.
- **Internal Padding:** 12px 18px 13px 20px (12px 14px on narrow screens). Above 900px the card hangs 104px past the page's right edge.

### Gap Note
- **Style:** Built like a comment card with no leader, because a gap has no sentence to point at. It is Comment Grey with a 2px Resting Mark top rule and 12px 18px padding. A Title-weight statement sits above a Body Small Soft Ink explanation, 2px apart. It sits in the page foot below a Resting Highlight hairline, never inside a clause.

### Closing Panel
- **Style:** A square Paper panel in the column on the canvas, padded 40px, gutter, 44px (28px 20px 32px on narrow screens). It holds a Headline, Soft Ink body copy capped at 58ch, and the primary action row. It reads as one more sheet laid on the canvas.

## Do's and Don'ts

### Do:
- **Do** set every source sentence in Tinos on Paper, with its change bar in the gutter (72px, or 44px at 640px and below) and its rank in a fixed tabular slot.
- **Do** keep exactly one flag in Markup Crimson, and show every other flag in Resting Highlight and Resting Mark grey.
- **Do** open comment cards directly under their sentence with the 280ms cubic-bezier(0.16, 1, 0.3, 1) fold, and fold the previous one back at the same time.
- **Do** separate layers with paper tone (canvas, strip or comment grey, white page) and with overlap past an edge.
- **Do** write counts and states as plain text in the grotesk ("1 flag", "no flags"), in sentence case.
- **Do** run every piece of user-facing copy, including labels, notes, empty states and errors, through the humanizer skill before it is committed.

### Don't:
- **Don't** use shadows, gradients, pills or badges anywhere. Depth is paper and overlap.
- **Don't** use Markup Crimson for the wordmark, the action, headings, links, hover states or decoration.
- **Don't** set Redline's own words in Tinos, or a quoted source sentence in Schibsted Grotesk.
- **Don't** round anything except the filled action (4px).
- **Don't** set text in Resting Mark grey; at 2.6:1 on white it is for bars and rules only.
- **Don't** uppercase or letter-space labels, or add a kicker or eyebrow line above a heading.
- **Don't** show a gap with a change bar, highlight or leader; it has no source sentence to mark.
