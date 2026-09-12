import {
  ModelCallError,
  parseStructuredOutput,
  type ModelClient,
  type StructuredRequest,
} from '../../lib/model/client';
import type { FixtureFlag, FixtureGap, FixtureSidecar } from '../fixtures';

/**
 * The model client the suite runs against. It reaches nothing: no network, no
 * key, no OpenRouter. What it returns is handed to it, and it goes through the
 * same parse and schema check as a real reply, so a stub cannot hand the code
 * under test a shape OpenRouter's client would have rejected.
 */
export interface StubModelClient extends ModelClient {
  /** Every request made, in order, exactly as the code under test built it. */
  calls: StructuredRequest[];
  /** Sets, or replaces, what a named call returns. */
  reply(name: string, payload: unknown): void;
  /** Makes a named call fail, the way an unreachable model does. */
  fail(name: string, message: string): void;
}

export type StubReplies = Record<string, unknown>;

export function createStubModelClient(replies: StubReplies = {}): StubModelClient {
  const payloads = new Map<string, unknown>(Object.entries(replies));
  const failures = new Map<string, string>();
  const calls: StructuredRequest[] = [];

  return {
    calls,
    reply(name, payload) {
      failures.delete(name);
      payloads.set(name, payload);
    },
    fail(name, message) {
      payloads.delete(name);
      failures.set(name, message);
    },
    async complete<T>(request: StructuredRequest): Promise<T> {
      calls.push(request);

      const failure = failures.get(request.name);
      if (failure !== undefined) {
        throw new ModelCallError(failure);
      }

      if (!payloads.has(request.name)) {
        throw new ModelCallError(
          `The stub model client has nothing to answer "${request.name}" with.`,
        );
      }

      // Serialised and re-parsed on purpose: what the code under test receives
      // has been through JSON and the schema check, exactly as a real reply has.
      return parseStructuredOutput<T>(
        JSON.stringify(payloads.get(request.name)),
        request,
      );
    },
  };
}

/**
 * What a model proposing flags for this fixture would send back.
 *
 * Every planted clause is proposed, decoys included, because a model favouring
 * recall proposes them and the code under test is what decides which of them a
 * reader ever sees. The two plausibility signals are what the sidecar says about
 * each clause, never what the expected outcome is: `plausible: false` on this
 * fixture means the clause is even-handed and moves nobody's money, so that is
 * what the stub reports, and ADR-0004's filter draws its own conclusion.
 */
export function proposedFlagsFor(sidecar: FixtureSidecar): unknown[] {
  const fromFlags = sidecar.flags.map((flag: FixtureFlag) => ({
    id: flag.id,
    clauseType: flag.clauseType,
    sourceSentence: flag.sourceSentence,
    severity: flag.severity,
    explanation: flag.explanation,
    changesYourEconomicsUnilaterally: flag.plausible,
    bindsBothSidesEqually: !flag.plausible,
    textualAmbiguity: flag.textualAmbiguity,
    alternativeReadings: readingsFor(sidecar, flag),
    harmConfidence: flag.harmConfidence,
  }));

  const symmetric = sidecar.decoys.symmetricUnusual;
  if (!symmetric) return fromFlags;

  return [
    ...fromFlags,
    {
      id: 'symmetric-unusual',
      clauseType: 'unusual but even-handed term',
      sourceSentence: symmetric.sourceSentence,
      severity: 30,
      explanation: symmetric.why,
      changesYourEconomicsUnilaterally: false,
      bindsBothSidesEqually: true,
      textualAmbiguity: false,
      alternativeReadings: [],
      harmConfidence: 'partial',
    },
  ];
}

/**
 * The two readings a model would send back for a clause whose sentence reads two
 * ways, taken from the sidecar's ambiguous decoy rather than written here. A
 * clause the sidecar does not call ambiguous gets none, which is what a model
 * that found no second reading sends.
 */
function readingsFor(sidecar: FixtureSidecar, flag: FixtureFlag): string[] {
  const ambiguous = sidecar.decoys.textuallyAmbiguous;
  if (
    !flag.textualAmbiguity ||
    !ambiguous ||
    ambiguous.sourceSentence !== flag.sourceSentence
  ) {
    return [];
  }
  return [ambiguous.readingA, ambiguous.readingB];
}

/**
 * What a model listing the missing terms for this fixture would send back.
 *
 * The band is left off, exactly as it is for flags: the model rates what the
 * absence costs, and the code under test decides what band that severity falls
 * in. No entry carries a source sentence, because the gap schema has no property
 * for one.
 */
export function proposedGapsFor(sidecar: FixtureSidecar): unknown[] {
  return sidecar.gaps.map((gap: FixtureGap) => ({
    id: gap.id,
    statement: gap.statement,
    severity: gap.severity,
    explanation: gap.explanation,
  }));
}

/**
 * A stub that answers from a fixture sidecar, so a test asserts against the
 * document it loaded rather than against wording invented in the test file.
 */
export function stubModelClientFor(sidecar: FixtureSidecar): StubModelClient {
  return createStubModelClient({
    document_summary: { summary: sidecar.summary },
    document_flags: { flags: proposedFlagsFor(sidecar) },
    document_gaps: { gaps: proposedGapsFor(sidecar) },
  });
}
