import {
  MINIMUM_READABLE_CHARACTERS,
  normalizeDocumentText,
  readableCharacterCount,
} from '../document-text';
import { analyzeDocument } from '../analysis/analyze-document';
import type { CleanRead, Gap, VerifiedFlag } from '../analysis/types';
import type { ModelClient } from '../model/client';
import type { TryAllowance } from './try-allowance';
import { MAXIMUM_DOCUMENT_CHARACTERS, tooLongReason } from './try-limits';

/**
 * One try without an account, end to end.
 *
 * **Nothing here can store anything.** Not because this function is careful
 * about it but because it holds nothing to store with: `AnonymousTryDeps` names
 * a model client and a daily allowance, and there is no documents gateway, no
 * Supabase client and no id to write against anywhere in this file. The text
 * arrives as an argument, is read, and goes out of scope. A future edit that
 * wanted to save a visitor's agreement would have to add a dependency to this
 * seam first, which is the point.
 *
 * The text is still the text every source sentence is checked against, because
 * `analyzeDocument` verifies each flag against the same string it was handed
 * (ADR-0001). Verified inside the request, kept nowhere after it.
 *
 * **Both limits are settled before the model is reached.** The length is a fact
 * about the argument and costs nothing to check, so it goes first and a document
 * that is too long does not spend one of the day's tries. The allowance is
 * claimed second, and only then does anything reach OpenRouter. There is no path
 * through this function on which a refusal happens after a model call, because
 * the model is only named below both of them.
 */
export interface AnonymousTryDeps {
  model: ModelClient;
  allowance: TryAllowance;
}

/**
 * What a visitor without an account gets: the plain-English summary, the ranked
 * flags with their source sentences, the gaps, or the clean read.
 *
 * No counter-offers, and no field one could sit in. That is not a special case
 * for anonymous readers — `analyzeDocument` drafts nothing for anybody, because
 * drafting replacement wording is separate work called per flag — so the
 * anonymous path gets it by doing less rather than by withholding.
 *
 * No red line matches either, since the read ran against an empty list.
 */
export interface AnonymousRead {
  summary: string;
  flags: VerifiedFlag[];
  gaps: Gap[];
  cleanRead: CleanRead | null;
}

/**
 * The read, or the reason there isn't one, with the status to answer with.
 *
 * A read comes back with `text`: the exact string every flag was checked
 * against. The visitor's browser sent the text it parsed, and this is that text
 * after the one normalisation on the way in (`lib/document-text.ts`), so it is
 * not always the same string. The difference matters twice — it is what the
 * marked-up page lines its flags up against, and it is what gets stored if the
 * visitor makes an account (`keep-try.ts`) — so the analysed text goes back
 * rather than leaving the tab to assume its own copy will do.
 */
export type TryOutcome =
  | { read: AnonymousRead; text: string; refused?: undefined; status?: undefined }
  | { read?: undefined; text?: undefined; refused: string; status: number };

/** What a visitor whose text is too thin to read is told. */
export const TOO_LITTLE_TEXT_REASON =
  'There isn’t enough text here to read. If the pages are scans or photographs, ' +
  'Redline can’t read them: it would have to guess at the wording, and then every ' +
  'sentence it quoted back to you would be its guess rather than your agreement.';

export async function tryDocument(
  deps: AnonymousTryDeps,
  text: string,
): Promise<TryOutcome> {
  const documentText = normalizeDocumentText(text);

  if (readableCharacterCount(documentText) < MINIMUM_READABLE_CHARACTERS) {
    return { refused: TOO_LITTLE_TEXT_REASON, status: 422 };
  }

  if (documentText.length > MAXIMUM_DOCUMENT_CHARACTERS) {
    return { refused: tooLongReason(documentText.length), status: 413 };
  }

  const allowance = await deps.allowance.claim();
  if (!allowance.allowed) {
    return { refused: allowance.reason, status: 429 };
  }

  // Below both limits, and the first line in this function that costs anything.
  // The empty list is the read a visitor gets: no red lines, because red lines
  // are something a reader keeps, and keeping things needs an account.
  const analysis = await analyzeDocument(documentText, [], { model: deps.model });

  return {
    text: documentText,
    read: {
      summary: analysis.summary,
      flags: analysis.flags,
      gaps: analysis.gaps,
      cleanRead: analysis.cleanRead,
    },
  };
}
