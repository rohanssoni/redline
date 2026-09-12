import type { ModelClient } from '../model/client';
import type { DocumentsGateway, StoredDocument } from '../documents/store';
import type { JudgeLogGateway } from '../judge/store';
import { redLineTexts, type RedLinesGateway } from '../red-lines/store';
import { analyzeDocument } from './analyze-document';

export interface ReadDocumentDeps {
  documents: DocumentsGateway;
  redLines: RedLinesGateway;
  model: ModelClient;
  /**
   * Where the judge's review of each red line match is kept (ADR-0018). It is
   * handed straight through, and nothing that comes back from the read reflects
   * it: the log is the only place the judge's opinion goes (ADR-0019).
   */
  judgeLog?: JudgeLogGateway;
  /**
   * The read itself, which is `analyzeDocument` everywhere in the product. It
   * is named here because the red lines this function fetches are handed
   * straight to it and are not yet visible in what comes back: the override
   * they drive is its own slice of work. Until then this is how the wiring can
   * be checked from outside.
   */
  analyze?: typeof analyzeDocument;
}

/**
 * Reads one of the reader's stored documents and keeps the result with it.
 *
 * The reader's red lines are fetched here, on the run, and handed to
 * `analyzeDocument` as the list it works from. Nothing caches them between
 * runs: a red line the reader wrote a minute ago drives the next read of any
 * document, and one they deleted stops driving it, which is what "the list
 * persists across documents" has to mean to be worth anything.
 *
 * Returns `null` when the id names no document of this reader's.
 */
export async function readDocument(
  deps: ReadDocumentDeps,
  documentId: string,
): Promise<StoredDocument | null> {
  const document = await deps.documents.byId(documentId);
  if (!document) return null;

  const redLines = await deps.redLines.list();
  const analyse = deps.analyze ?? analyzeDocument;
  const analysis = await analyse(document.text, redLineTexts(redLines), {
    model: deps.model,
    judgeLog: deps.judgeLog,
  });

  return deps.documents.recordAnalysis(document.id, analysis);
}
