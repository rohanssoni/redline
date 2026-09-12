import {
  ModelCallError,
  parseStructuredOutput,
  type ModelClient,
  type StructuredRequest,
} from '../../lib/model/client';
import type { FixtureSidecar } from '../fixtures';

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
 * A stub that answers from a fixture sidecar, so a test asserts against the
 * document it loaded rather than against wording invented in the test file.
 */
export function stubModelClientFor(sidecar: FixtureSidecar): StubModelClient {
  return createStubModelClient({
    document_summary: { summary: sidecar.summary },
  });
}
