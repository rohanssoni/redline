import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelCallError, ModelOutputError, type StructuredRequest } from './client';
import { createOpenRouterClient } from './openrouter';

const request: StructuredRequest = {
  name: 'document_summary',
  schema: {
    type: 'object',
    properties: { summary: { type: 'string' } },
    required: ['summary'],
    additionalProperties: false,
  },
  messages: [{ role: 'user', content: 'Summarise the agreement below.' }],
};

interface Sent {
  url: string;
  init: RequestInit;
  body: Record<string, any>;
}

function recordingFetch(reply: { status?: number; payload: unknown }) {
  const sent: Sent[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      init: init ?? {},
      body: JSON.parse(String(init?.body ?? '{}')),
    });
    return new Response(JSON.stringify(reply.payload), {
      status: reply.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}

/** Answers each call with the next reply in the list, recording what was sent. */
function sequenceFetch(replies: Array<{ status?: number; payload: unknown }>) {
  const sent: Sent[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      init: init ?? {},
      body: JSON.parse(String(init?.body ?? '{}')),
    });
    const reply = replies[sent.length - 1];
    return new Response(JSON.stringify(reply.payload), {
      status: reply.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}

/** What OpenRouter sends when the provider's shared pool is full. */
function rateLimited(retryAfterSeconds: number) {
  return {
    error: {
      code: 429,
      message: 'Provider returned error',
      metadata: {
        raw: 'The model is temporarily rate-limited upstream.',
        provider_name: 'Fireworks',
        retry_after_seconds: retryAfterSeconds,
      },
    },
  };
}

/** A sleep that returns at once and writes down how long it was asked for. */
function recordingSleep(waits: number[]) {
  return async (ms: number) => {
    waits.push(ms);
  };
}

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'a-model-id-from-the-environment';
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('createOpenRouterClient', () => {
  it('asks OpenRouter for structured output, pinned to one provider', async () => {
    const { sent, fetchImpl } = recordingFetch({
      payload: completion(JSON.stringify({ summary: 'What this agreement says.' })),
    });

    const result = await createOpenRouterClient({ fetchImpl }).complete<{
      summary: string;
    }>(request);

    expect(result.summary).toBe('What this agreement says.');
    expect(sent).toHaveLength(1);
    const [call] = sent;
    expect(call.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(call.body.model).toBe('a-model-id-from-the-environment');
    expect(call.body.provider).toEqual({
      order: ['fireworks'],
      allow_fallbacks: false,
      require_parameters: true,
    });
    expect(call.body.reasoning).toEqual({ effort: 'low' });
    expect(call.body.response_format.type).toBe('json_schema');
    expect(call.body.response_format.json_schema.strict).toBe(true);
    expect(call.body.response_format.json_schema.name).toBe('document_summary');
    expect(call.body.response_format.json_schema.schema).toEqual(request.schema);
    expect(
      (call.init.headers as Record<string, string>).Authorization,
    ).toBe('Bearer test-key');
  });

  it('takes the model id from the environment on every call', async () => {
    const { sent, fetchImpl } = recordingFetch({
      payload: completion(JSON.stringify({ summary: 'What this agreement says.' })),
    });
    const client = createOpenRouterClient({ fetchImpl });

    await client.complete(request);
    process.env.OPENROUTER_MODEL = 'a-different-model-id';
    await client.complete(request);

    expect(sent.map((call) => call.body.model)).toEqual([
      'a-model-id-from-the-environment',
      'a-different-model-id',
    ]);
  });

  it('names the missing variable when the key is absent', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { sent, fetchImpl } = recordingFetch({ payload: completion('{}') });

    await expect(
      createOpenRouterClient({ fetchImpl }).complete(request),
    ).rejects.toThrow(/OPENROUTER_API_KEY/);
    expect(sent).toHaveLength(0);
  });

  it('names the missing variable when the model id is absent', async () => {
    delete process.env.OPENROUTER_MODEL;
    const { sent, fetchImpl } = recordingFetch({ payload: completion('{}') });

    await expect(
      createOpenRouterClient({ fetchImpl }).complete(request),
    ).rejects.toThrow(/OPENROUTER_MODEL/);
    expect(sent).toHaveLength(0);
  });

  it('refuses a reply that does not match the schema it asked for', async () => {
    const { fetchImpl } = recordingFetch({
      payload: completion(JSON.stringify({ summary: 'ok', flags: [] })),
    });

    await expect(
      createOpenRouterClient({ fetchImpl }).complete(request),
    ).rejects.toBeInstanceOf(ModelOutputError);
  });

  it('refuses a reply that is not JSON', async () => {
    const { fetchImpl } = recordingFetch({
      payload: completion('Here is your summary!'),
    });

    await expect(
      createOpenRouterClient({ fetchImpl }).complete(request),
    ).rejects.toBeInstanceOf(ModelOutputError);
  });

  it('reports an error status with what OpenRouter said', async () => {
    const { fetchImpl } = recordingFetch({
      status: 402,
      payload: { error: { message: 'Insufficient credits' } },
    });

    await expect(
      createOpenRouterClient({ fetchImpl }).complete(request),
    ).rejects.toThrow(/Insufficient credits/);
  });

  it('reports an error other than a rate limit after one attempt', async () => {
    const { sent, fetchImpl } = recordingFetch({
      status: 402,
      payload: { error: { message: 'Insufficient credits' } },
    });
    const waits: number[] = [];

    await expect(
      createOpenRouterClient({ fetchImpl, sleep: recordingSleep(waits) }).complete(request),
    ).rejects.toThrow(/Insufficient credits/);
    expect(sent).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it('waits as long as the rate limit asks and tries again', async () => {
    const { sent, fetchImpl } = sequenceFetch([
      { status: 429, payload: rateLimited(5) },
      { payload: completion(JSON.stringify({ summary: 'What this agreement says.' })) },
    ]);
    const waits: number[] = [];

    const result = await createOpenRouterClient({
      fetchImpl,
      sleep: recordingSleep(waits),
    }).complete<{ summary: string }>(request);

    expect(result.summary).toBe('What this agreement says.');
    expect(sent).toHaveLength(2);
    expect(waits).toEqual([5000]);
  });

  it('gives up after two retries', async () => {
    const { sent, fetchImpl } = sequenceFetch([
      { status: 429, payload: rateLimited(5) },
      { status: 429, payload: rateLimited(5) },
      { status: 429, payload: rateLimited(5) },
      { payload: completion(JSON.stringify({ summary: 'Never reached.' })) },
    ]);
    const waits: number[] = [];

    await expect(
      createOpenRouterClient({ fetchImpl, sleep: recordingSleep(waits) }).complete(request),
    ).rejects.toBeInstanceOf(ModelCallError);
    expect(sent).toHaveLength(3);
    expect(waits).toEqual([5000, 5000]);
  });

  it('waits no longer than ten seconds, whatever the rate limit asks', async () => {
    const { fetchImpl } = sequenceFetch([
      { status: 429, payload: rateLimited(120) },
      { payload: completion(JSON.stringify({ summary: 'What this agreement says.' })) },
    ]);
    const waits: number[] = [];

    await createOpenRouterClient({ fetchImpl, sleep: recordingSleep(waits) }).complete(request);

    expect(waits).toEqual([10000]);
  });

  it('waits five seconds when the rate limit does not say how long', async () => {
    const { fetchImpl } = sequenceFetch([
      { status: 429, payload: { error: { message: 'Provider returned error' } } },
      { payload: completion(JSON.stringify({ summary: 'What this agreement says.' })) },
    ]);
    const waits: number[] = [];

    await createOpenRouterClient({ fetchImpl, sleep: recordingSleep(waits) }).complete(request);

    expect(waits).toEqual([5000]);
  });

  it('reports a network failure as a call error', async () => {
    const fetchImpl = (async () => {
      throw new Error('getaddrinfo ENOTFOUND openrouter.ai');
    }) as unknown as typeof fetch;

    await expect(
      createOpenRouterClient({ fetchImpl }).complete(request),
    ).rejects.toBeInstanceOf(ModelCallError);
  });
});
