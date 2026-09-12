import type { ModelClient } from '../model/client';
import type { SeverityBand, VerifiedFlag } from './verified-flag';

export type {
  Flag,
  HarmConfidence,
  ProposedFlag,
  SeverityBand,
  VerifiedFlag,
} from './verified-flag';

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
  /**
   * Worst first. The type is `VerifiedFlag`, not `Flag`: only `verifyFlags` can
   * produce one, so a flag whose source sentence was not found in the document
   * has nowhere to go (ADR-0001).
   */
  flags: VerifiedFlag[];
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
