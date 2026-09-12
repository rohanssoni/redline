import type { ModelClient } from '../model/client';

/** What a flag or gap costs the reader if it fires (CONTEXT.md: severity). */
export type SeverityBand = 'high' | 'medium' | 'low';

/** How sure the analysis is that the clause harms the reader (ADR-0006). */
export type HarmConfidence = 'full' | 'partial';

/** A clause capable of harming the reader, bound to its source sentence (ADR-0001). */
export interface Flag {
  id: string;
  clauseType: string;
  /** Verbatim from the document text. Verified before a flag can be shown. */
  sourceSentence: string;
  severity: number;
  band: SeverityBand;
  explanation: string;
  /** True only where the sentence's own wording is open to two readings (ADR-0010). */
  textualAmbiguity: boolean;
  harmConfidence: HarmConfidence;
}

/** A term the agreement does not contain. Has no source sentence (ADR-0005). */
export interface Gap {
  id: string;
  severity: number;
  band: SeverityBand;
  statement: string;
  explanation: string;
}

/** Everything `analyzeDocument` produces for one document. */
export interface AnalysisResult {
  /** Plain English, no severity, no source sentences. */
  summary: string;
  flags: Flag[];
  gaps: Gap[];
}

/** Everything `analyzeDocument` reaches outside itself for. */
export interface AnalysisDeps {
  model: ModelClient;
}

/** Raised when a document cannot be analysed, with a reason a reader can read. */
export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}
