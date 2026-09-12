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
}

interface ChatCompletionReply {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: string };
}

/** The real client: OpenRouter's OpenAI-compatible chat completions endpoint. */
export function createOpenRouterClient(
  options: OpenRouterOptions = {},
): ModelClient {
  const doFetch = options.fetchImpl ?? fetch;

  return {
    async complete<T>(request: StructuredRequest): Promise<T> {
      assertServerSide();
      const apiKey = readEnv('OPENROUTER_API_KEY');
      const model = readEnv('OPENROUTER_MODEL');

      let response: Response;
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

      const body = (await response.json().catch(() => null)) as
        | ChatCompletionReply
        | null;

      if (!response.ok) {
        const detail = body?.error?.message ?? `HTTP ${response.status}`;
        throw new ModelCallError(`OpenRouter refused ${request.name}: ${detail}`);
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
