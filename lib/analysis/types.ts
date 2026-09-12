import type { ModelClient } from '../model/client';
import type { JudgeLogGateway } from '../judge/store';
import type { CleanRead } from './clean-read';
import type { CounterOffer } from './counter-offer';
import type { Gap } from './gap';
import type { RedLineMatch } from './red-line-override';
import type { VerifiedFlag } from './verified-flag';

/** The result when nothing in a document clears the severity threshold. */
export type { CleanRead, CompletedRead } from './clean-read';

export type {
  AmbiguousSentence,
  Flag,
  HarmConfidence,
  ProposedFlag,
  SeverityBand,
  VerifiedFlag,
} from './verified-flag';

/**
 * A term the agreement does not contain. Has no source sentence, and no field it
 * could be given one through (ADR-0005).
 */
export type { Gap, GapClaim } from './gap';

/** Which flags a red line put in front of the reader (ADR-0013). Internal. */
export type { RedLineMatch } from './red-line-override';

/**
 * Replacement language for one flagged clause, in the stance the reader chose
 * (ADR-0009). A gap has none and can have none (ADR-0014).
 */
export type {
  ClauseToRewrite,
  CounterOffer,
  CounterOfferClaim,
  Stance,
} from './counter-offer';

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
  /**
   * Worst first. The type is `Gap`, not `GapClaim`: only `verifyGaps` can produce
   * one, and the shape it produces has nowhere to put a source sentence, so a gap
   * cannot arrive here claiming a citation (ADR-0005).
   */
  gaps: Gap[];
  /**
   * The clean read, when a finished read found nothing above the severity
   * threshold, and `null` when it found something (ADR-0008).
   *
   * This, not `flags.length === 0`, is what decides the reader sees the clean
   * read. Only `cleanReadFor` can produce the type, and it can only be called
   * with stages that ran, so a failed or half-finished analysis has no way to
   * arrive here holding one.
   */
  cleanRead: CleanRead | null;
  /**
   * The flags a red line put in front of the reader, and which red line did it
   * (ADR-0013).
   *
   * Internal, and deliberately beside the flags rather than inside them: a
   * red-line-triggered flag is an ordinary flag with an ordinary source
   * sentence, and the reader is shown no marker, no badge and no note about the
   * match. This is what the judge (ADR-0018) and the dismissal rate read.
   *
   * Every entry names a flag in `flags`, because both lists are built from what
   * came back through the source sentence check (ADR-0001).
   */
  redLineMatches: RedLineMatch[];
  /**
   * The soft counter-offer drafted for each flag, keyed to the flag by id
   * (ADR-0009). The type is `CounterOffer`, not `CounterOfferClaim`: only
   * `draftCounterOffer` and `verifyCounterOffers` produce one, and both of them
   * check the draft against the source sentence of the flag it belongs to, so a
   * draft that rewrote some other clause cannot arrive here.
   *
   * Never every flag by construction. A flag whose draft failed or came back
   * about the wrong sentence is in `flags` with nothing in here naming it, and
   * an analysis nobody has drafted for — a visitor's one try, which gets the
   * summary and the flags and no counter-offers — carries none at all.
   *
   * There is no entry here for a gap, and no way to write one: `flagId` names a
   * flag, and nothing in the drafting path will take a gap (ADR-0014).
   */
  counterOffers: CounterOffer[];
}

/** Everything `analyzeDocument` reaches outside itself for. */
export interface AnalysisDeps {
  model: ModelClient;
  /**
   * Where the judge's review of each red line match is kept for audit
   * (ADR-0018). Optional, and deliberately so: a run with nowhere to log still
   * produces every flag it would otherwise, because the flag is the guarantee
   * and the judge is a signal about the matcher (ADR-0019).
   */
  judgeLog?: JudgeLogGateway;
}

/** Raised when a document cannot be analysed, with a reason a reader can read. */
export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}
