/**
 * A red line is a term the reader decided in advance they will not accept
 * (`CONTEXT.md`). It is written by the reader, in their own words, and it
 * belongs to them rather than to any one document: the same list is read on
 * every analysis they run.
 */
export interface RedLine {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

/** The shape of a row in the `red_lines` table. */
export interface RedLineRow {
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

/** Raised when the store cannot be read or written. */
export class RedLineStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedLineStoreError';
  }
}

/**
 * Everything the product does with a reader's red lines. One reader's list: the
 * owner is fixed when the gateway is built, and the database enforces the same
 * thing again through row level security.
 */
export interface RedLinesGateway {
  /** The reader's list, oldest first, so the order they wrote them holds. */
  list(): Promise<RedLine[]>;
  add(text: string): Promise<RedLine>;
  edit(id: string, text: string): Promise<RedLine>;
  /** Whether a red line of the reader's own was removed. */
  remove(id: string): Promise<boolean>;
}

/** The longest a red line can be. A red line is a sentence, not a policy. */
export const RED_LINE_MAX_LENGTH = 300;

export function toRedLine(row: RedLineRow): RedLine {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** What `analyzeDocument` takes: the reader's red lines, in their own words. */
export function redLineTexts(redLines: readonly RedLine[]): string[] {
  return redLines.map((redLine) => redLine.text);
}

/**
 * What the reader typed, checked before it goes anywhere near the table, or the
 * reason it cannot be saved in words the reader can act on.
 *
 * Whitespace is collapsed because a red line is read back to the model as one
 * line of the reader's own prose, and because two red lines differing only in
 * how they were pasted are the same red line.
 */
export type RedLineCheck = { text: string } | { problem: string };

export function checkRedLine(written: string): RedLineCheck {
  const text = written.replace(/\s+/g, ' ').trim();
  if (text.length === 0) {
    return { problem: 'Write the term you won’t accept, in your own words.' };
  }
  if (text.length > RED_LINE_MAX_LENGTH) {
    return {
      problem: `Keep it to ${RED_LINE_MAX_LENGTH} characters. If you have two red lines here, add them one at a time.`,
    };
  }
  return { text };
}
