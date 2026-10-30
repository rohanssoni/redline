# Hand labels for ten flags

A page for labelling ten flags from an eval run by hand. The labels are the owner's.
Nothing in this folder suggests one.

## Opening the page again

```
npm run label
```

The server prints the address, `http://127.0.0.1:4317/` unless that port is taken,
in which case it uses the next free one. Open that address in Chrome, Safari or
Firefox. Labels are saved to `labels.json` in this folder every time one changes,
and the page shows whatever `labels.json` already holds when it loads, so it can be
closed and picked up later. The browser keeps a copy too. If the server stops, the
page says so and offers a button that copies the labels to the clipboard, and it
sends the browser's copy back once the server is running again.

## Which run

`eval-runs/2026-10-30T16-48-37Z.json`, the newest run record, read with
`z-ai/glm-5.3-flash`. `flags.json` names the run it was built from.

## How the ten were picked

1. Only flags the reader would be shown: the run record's `flags`, which are what came
   through every filter and the citation check.
2. Any flag whose quoted sentence is not in its document file character for character
   was left out. Two were. The pipeline compares quotes after collapsing spaces and
   turning non-breaking spaces into plain ones (ADR-0021), so a quote can pass there
   and still differ from the file.
3. Then in this order:
   - every flag that matched no planted clause, including those on the documents that
     should come back clean;
   - every flag that matched a planted clause but named a different clause type;
   - flags from the most severe band, then the next band down, until there were ten.

   Whether a flag matched a planted clause comes from the run record, which the eval
   works out by overlapping spans against the gold set.
4. The first two groups held 28 flags between them, more than ten, so ten were taken
   from them, spread over as many documents as possible. The first group comes first,
   so the ten all came from it. Its flags were taken one document at a time, in the
   order `manifest.json` lists documents and from the highest severity down within a
   document. Nine documents had one each, and the tenth flag was a second from the
   first document in that order.
5. The ten are sorted by document, then by where the sentence sits in it, and numbered
   1 to 10. For each, `flags.json` holds the document, clause type, severity, the
   quoted sentence copied from the run record, and the paragraph around it copied from
   the document file. It doesn't say which group a flag came from or whether it
   matched a planted clause.

## The rule

**PASS** if the quoted sentence really is the kind of clause the flag names and really
costs the reader something. Otherwise **FAIL**.

The page shows the rule beside two sections of `PRD.md`, copied word for word when the
page loads. They are "2. Flags and gaps, ranked by severity, each showing its source",
which is what this product flags, and "Success metrics". `PRD.md` has no section
called "What good looks like" or "My red lines", and those two are the nearest
(`eval/README.md`, decision 3).

## labels.json

```json
{
  "run": "2026-10-30T16-48-37Z",
  "flags": {
    "1": {
      "label": "PASS or FAIL or null",
      "note": "one sentence on why",
      "labelledAt": "when the current label was given",
      "history": [{ "label": "the earlier label", "note": "its note", "givenAt": "…", "changedAt": "…" }]
    }
  },
  "changesOfMind": 0,
  "reflection": "what changed in how I judge",
  "updatedAt": "…"
}
```

A change of mind is a label switched from PASS to FAIL or back. The earlier label
moves into `history` with the time it was changed. Editing a note doesn't count.
