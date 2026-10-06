import {
  ModelCallError,
  ModelOutputError,
  parseStructuredOutput,
  type ModelClient,
  type StructuredRequest,
} from './client';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Server-side only. `OPENROUTER_API_KEY` has no `NEXT_PUBLIC_` prefix, so it is
 * never inlined into a browser bundle; this guard makes the mistake loud rather
 * than silent if this module is ever imported from a client component.
 */
function assertServerSide(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'The OpenRouter client runs on the server only. Call it from a route handler, not from the browser.',
    );
  }
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${name} is not set. Add it to .env.local before running an analysis.`,
    );
  }
  return value.trim();
}

export interface OpenRouterOptions {
  /** Injected in tests so the suite never touches the network. */
  fetchImpl?: typeof fetch;
  /** Injected in tests so a rate-limit retry does not really wait. */
  sleep?: (ms: number) => Promise<void>;
}

interface ChatCompletionReply {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: {
    message?: string;
    metadata?: { retry_after_seconds?: unknown; provider_name?: unknown; raw?: unknown };
  };
}

/**
 * What OpenRouter said, for the log. Its message for a provider's refusal is
 * only "Provider returned error"; the reason is in the metadata.
 */
function refusalDetail(body: ChatCompletionReply | null, status: number): string {
  const message = body?.error?.message ?? 'no message';
  const metadata = body?.error?.metadata;
  const from =
    typeof metadata?.provider_name === 'string' ? `${metadata.provider_name}: ` : '';
  const why = typeof metadata?.raw === 'string' ? ` (${from}${metadata.raw})` : '';
  return `${message}${why} [HTTP ${status}]`;
}

/**
 * The provider is pinned with no fallback, and its pool for this model is
 * shared with every other OpenRouter customer, so it turns calls away for a few
 * seconds at a time when the pool is full. A read is four or more calls in a
 * row, and one refusal anywhere used to fail the whole read. A 429 is retried
 * this many times, after the wait it asks for, before it is reported.
 */
const RATE_LIMIT_RETRIES = 2;
/** The wait when a 429 does not say how long to wait. */
const DEFAULT_RATE_LIMIT_WAIT_MS = 5_000;
/** The longest single wait, so retries cannot run a read past its time. */
const LONGEST_RATE_LIMIT_WAIT_MS = 10_000;

function rateLimitWaitMs(body: ChatCompletionReply | null): number {
  const seconds = Number(body?.error?.metadata?.retry_after_seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_RATE_LIMIT_WAIT_MS;
  return Math.min(seconds * 1_000, LONGEST_RATE_LIMIT_WAIT_MS);
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The real client: OpenRouter's OpenAI-compatible chat completions endpoint. */
export function createOpenRouterClient(
  options: OpenRouterOptions = {},
): ModelClient {
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? realSleep;

  return {
    async complete<T>(request: StructuredRequest): Promise<T> {
      assertServerSide();
      const apiKey = readEnv('OPENROUTER_API_KEY');
      const model = readEnv('OPENROUTER_MODEL');

      let response: Response;
      let body: ChatCompletionReply | null;
      for (let attempt = 0; ; attempt += 1) {
        try {
          response = await doFetch(ENDPOINT, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: request.messages,
              provider: {
                order: ['fireworks'],
                allow_fallbacks: false,
                require_parameters: true,
              },
              reasoning: { effort: 'low' },
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: request.name,
                  strict: true,
                  schema: request.schema,
                },
              },
            }),
          });
        } catch (cause) {
          throw new ModelCallError(
            `Could not reach OpenRouter for ${request.name}: ${messageOf(cause)}`,
          );
        }

        body = (await response.json().catch(() => null)) as
          | ChatCompletionReply
          | null;

        if (response.status !== 429 || attempt === RATE_LIMIT_RETRIES) break;
        await sleep(rateLimitWaitMs(body));
      }

      if (!response.ok) {
        throw new ModelCallError(
          `OpenRouter refused ${request.name}: ${refusalDetail(body, response.status)}`,
          response.status,
        );
      }

      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new ModelOutputError(
          `OpenRouter returned no content for ${request.name}.`,
        );
      }

      return parseStructuredOutput<T>(content, request);
    },
  };
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
