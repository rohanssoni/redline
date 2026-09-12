import { checkAgainstSchema, type ObjectSchema } from './json-schema';

/**
 * The one boundary in Redline that reaches a model. It is narrow on purpose: it
 * is the only thing the test suite stubs, so everything between it and the
 * reader is exercised for real.
 */
export interface ModelClient {
  /**
   * Sends `messages` and returns the model's reply parsed against `schema`.
   * Throws if the reply is not valid JSON or does not match the schema.
   */
  complete<T>(request: StructuredRequest): Promise<T>;
}

export interface ModelMessage {
  role: 'system' | 'user';
  content: string;
}

export interface StructuredRequest {
  /** Names the call in logs and in the structured-output request. */
  name: string;
  messages: ModelMessage[];
  schema: ObjectSchema;
}

/** Raised when a model reply cannot be trusted as the shape that was asked for. */
export class ModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelOutputError';
  }
}

/** Raised when the model could not be reached or answered with an error. */
export class ModelCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelCallError';
  }
}

/**
 * Parses a reply and checks it against the schema that was requested. Shared by
 * every `ModelClient`, including the test stub, so a stub cannot return a shape
 * the real client would have rejected.
 */
export function parseStructuredOutput<T>(
  content: string,
  request: StructuredRequest,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ModelOutputError(
      `The model's reply to ${request.name} was not JSON.`,
    );
  }

  const problems = checkAgainstSchema(parsed, request.schema);
  if (problems.length > 0) {
    const detail = problems
      .map((problem) => `${problem.path}: ${problem.message}`)
      .join('; ');
    throw new ModelOutputError(
      `The model's reply to ${request.name} did not match the schema (${detail}).`,
    );
  }

  return parsed as T;
}
