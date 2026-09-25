import { afterEach, describe, expect, it, vi } from 'vitest';
import { BitbucketClient } from '../src/bitbucket/client';
import type { AppConfig } from '../src/config';
import type { Logger } from '../src/logger';

const reference = {
  workspace: 'workspace',
  repoSlug: 'repository',
  prId: '42',
};

const pullRequestPayload = {
  id: 42,
  title: 'Pull request',
  description: null,
  state: 'OPEN',
  author: { display_name: null, account_id: 'account' },
  source: { branch: { name: 'feature' } },
  destination: { branch: { name: 'main' } },
  links: {
    html: { href: 'https://bitbucket.org/example/pull-requests/42' },
  },
};

const baseConfig: AppConfig = {
  apiToken: 'secret-token',
  apiBaseUrl: 'https://api.bitbucket.org/2.0/',
  requestTimeoutMs: 15_000,
  maxRetries: 2,
  maxPages: 20,
  maxCommits: 1_000,
  maxDiffBytes: 2_000_000,
  maxJsonBytes: 1_000_000,
};

const logger: Logger = {
  warn: vi.fn(),
  error: vi.fn(),
};

function jsonResponse(
  payload: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  const init: ResponseInit =
    headers === undefined ? { status } : { status, headers };
  return new Response(JSON.stringify(payload), init);
}

function createClient(
  fetchMock: ReturnType<typeof vi.fn>,
  config: Partial<AppConfig> = {},
  dependencies: {
    random?: () => number;
    sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  } = {},
): BitbucketClient {
  return new BitbucketClient(
    { ...baseConfig, ...config },
    {
      fetch: fetchMock as unknown as typeof fetch,
      logger,
      random: dependencies.random ?? (() => 0),
      sleep: dependencies.sleep ?? vi.fn(async () => undefined),
    },
  );
}

function errorStream(error: unknown): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(error);
      },
    }),
  );
}

describe('BitbucketClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('fetches and maps pull request metadata', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(pullRequestPayload));
    const client = createClient(fetchMock);

    const result = await client.getPullRequest(reference);

    expect(result).toEqual({
      id: 42,
      title: 'Pull request',
      description: '',
      state: 'OPEN',
      author: { display_name: '', account_id: 'account' },
      source: { branch: { name: 'feature' } },
      destination: { branch: { name: 'main' } },
      links: {
        html: {
          href: 'https://bitbucket.org/example/pull-requests/42',
        },
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock
      .calls[0] as unknown as Parameters<typeof fetch>;
    expect(String(url)).toBe(
      'https://api.bitbucket.org/2.0/repositories/workspace/repository/pullrequests/42',
    );
    expect(options).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer secret-token',
      },
    });
  });

  it('maps a missing author to null', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...pullRequestPayload,
        author: undefined,
      }),
    );

    const result = await createClient(fetchMock).getPullRequest(reference);

    expect(result.author).toBeNull();
  });

  it('rejects malformed pull request data', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 42 }));

    await expect(
      createClient(fetchMock).getPullRequest(reference),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('rejects malformed JSON', async () => {
    const fetchMock = vi.fn(async () => new Response('{'));

    await expect(
      createClient(fetchMock).getPullRequest(reference),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('rejects oversized JSON responses', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(pullRequestPayload));

    await expect(
      createClient(fetchMock, { maxJsonBytes: 10 }).getPullRequest(
        reference,
      ),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  it('fetches all commit pages and maps optional fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          values: [
            {
              hash: 'first',
              message: null,
              date: null,
              author: null,
            },
          ],
          next: 'repositories/workspace/repository/pullrequests/42/commits?page=2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          values: [
            {
              hash: 'second',
              message: 'Message',
              date: '2026-01-01',
              author: { raw: 'Author' },
            },
          ],
        }),
      );

    const result =
      await createClient(fetchMock).getPullRequestCommits(reference);

    expect(result).toEqual({
      values: [
        { hash: 'first', message: '', date: '', author: { raw: '' } },
        {
          hash: 'second',
          message: 'Message',
          date: '2026-01-01',
          author: { raw: 'Author' },
        },
      ],
      fetched_count: 2,
      truncated: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('truncates commits at the configured item limit', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        values: [{ hash: 'first' }, { hash: 'second' }],
      }),
    );

    const result = await createClient(fetchMock, {
      maxCommits: 1,
    }).getPullRequestCommits(reference);

    expect(result.values).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it('truncates pagination at the configured page limit', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        values: [{ hash: 'first' }],
        next: 'repositories/workspace/repository/pullrequests/42/commits?page=2',
      }),
    );

    const result = await createClient(fetchMock, {
      maxPages: 1,
    }).getPullRequestCommits(reference);

    expect(result.truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects repeated pagination URLs', async () => {
    const firstUrl =
      'https://api.bitbucket.org/2.0/repositories/workspace/repository/pullrequests/42/commits?pagelen=100';
    const fetchMock = vi.fn(async () =>
      jsonResponse({ values: [], next: firstUrl }),
    );

    await expect(
      createClient(fetchMock).getPullRequestCommits(reference),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('rejects cross-origin pagination URLs', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ values: [], next: 'https://attacker.example/page' }),
    );

    await expect(
      createClient(fetchMock).getPullRequestCommits(reference),
    ).rejects.toMatchObject({ code: 'UNSAFE_UPSTREAM_URL' });
  });

  it('rejects malformed commit pages', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ values: null }));

    await expect(
      createClient(fetchMock).getPullRequestCommits(reference),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('uses redirect follow for diff requests', async () => {
    const fetchMock = vi.fn(async () => new Response('diff content'));
    const client = createClient(fetchMock);

    await client.getPullRequestDiff(reference);

    const [url, options] = fetchMock.mock
      .calls[0] as unknown as Parameters<typeof fetch>;
    expect(String(url)).toBe(
      'https://api.bitbucket.org/2.0/repositories/workspace/repository/pullrequests/42/diff',
    );
    expect(options).toMatchObject({ redirect: 'follow' });
  });

  it('returns and truncates diffs at the byte limit', async () => {
    const fetchMock = vi.fn(async () => new Response('abcdef'));

    const result = await createClient(fetchMock, {
      maxDiffBytes: 4,
    }).getPullRequestDiff(reference);

    expect(result).toEqual({ diff: 'abcd', bytes: 4, truncated: true });
  });

  it('handles empty response bodies', async () => {
    const fetchMock = vi.fn(async () => new Response(null));

    const result =
      await createClient(fetchMock).getPullRequestDiff(reference);

    expect(result).toEqual({ diff: '', bytes: 0, truncated: false });
  });

  it('does not truncate a response exactly at the byte limit', async () => {
    const fetchMock = vi.fn(async () => new Response('abcd'));

    const result = await createClient(fetchMock, {
      maxDiffBytes: 4,
    }).getPullRequestDiff(reference);

    expect(result.truncated).toBe(false);
  });

  it('retries retryable responses with bounded Retry-After', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 503,
          headers: { 'retry-after': '60' },
        }),
      )
      .mockResolvedValueOnce(new Response('diff'));

    const result = await createClient(
      fetchMock,
      {},
      { sleep },
    ).getPullRequestDiff(reference);

    expect(result.diff).toBe('diff');
    expect(sleep).toHaveBeenCalledWith(30_000, undefined);
    expect(logger.warn).toHaveBeenCalledWith('bitbucket_request_retry', {
      attempt: 1,
      status: 503,
      delay_ms: 30_000,
    });
  });

  it('preserves the upstream Retry-After in final errors', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 429,
          headers: { 'retry-after': '60' },
        }),
    );

    await expect(
      createClient(fetchMock, { maxRetries: 0 }).getPullRequest(reference),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 60,
    });
  });

  it('parses date-based Retry-After values', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const sleep = vi.fn(async () => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 503,
          headers: { 'retry-after': 'Thu, 01 Jan 2026 00:00:01 GMT' },
        }),
      )
      .mockResolvedValueOnce(new Response('diff'));

    await createClient(fetchMock, {}, { sleep }).getPullRequestDiff(
      reference,
    );

    expect(sleep).toHaveBeenCalledWith(1_000, undefined);
  });

  it('uses exponential delay when Retry-After is invalid', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 503,
          headers: { 'retry-after': 'invalid' },
        }),
      )
      .mockResolvedValueOnce(new Response('diff'));

    await createClient(
      fetchMock,
      {},
      { random: () => 0.5, sleep },
    ).getPullRequestDiff(reference);

    expect(sleep).toHaveBeenCalledWith(300, undefined);
  });

  it('uses exponential delay when Retry-After is absent', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('diff'));

    await createClient(fetchMock, {}, { sleep }).getPullRequestDiff(
      reference,
    );

    expect(sleep).toHaveBeenCalledWith(250, undefined);
  });

  it('uses the default retry sleep', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('diff'));
    const client = new BitbucketClient(baseConfig, {
      fetch: fetchMock as unknown as typeof fetch,
      logger,
      random: () => 0,
    });

    const request = client.getPullRequestDiff(reference);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toMatchObject({ diff: 'diff' });
  });

  it('cancels the default retry sleep', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 503 }),
    );
    const client = new BitbucketClient(baseConfig, {
      fetch: fetchMock as unknown as typeof fetch,
      logger,
      random: () => 0,
    });

    const request = client.getPullRequestDiff(
      reference,
      controller.signal,
    );
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    controller.abort('cancelled');

    await expect(request).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('retries network failures', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(new Response('diff'));

    const result = await createClient(
      fetchMock,
      {},
      { sleep },
    ).getPullRequestDiff(reference);

    expect(result.diff).toBe('diff');
    expect(sleep).toHaveBeenCalledWith(250, undefined);
    expect(logger.warn).toHaveBeenCalledWith('bitbucket_network_retry', {
      attempt: 1,
      delay_ms: 250,
    });
  });

  it('returns a network error after retries are exhausted', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network');
    });

    await expect(
      createClient(fetchMock, { maxRetries: 0 }).getPullRequest(reference),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('maps caller cancellation during fetch', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    const fetchMock = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });

    await expect(
      createClient(fetchMock).getPullRequest(reference, controller.signal),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('maps request timeouts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (_url: URL, options: RequestInit): Promise<Response> =>
        await new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(new DOMException('timeout', 'TimeoutError'));
          });
        }),
    );
    const request = createClient(fetchMock, {
      requestTimeoutMs: 1,
      maxRetries: 0,
    }).getPullRequest(reference);
    const assertion = expect(request).rejects.toMatchObject({
      code: 'TIMEOUT',
    });

    await vi.advanceTimersByTimeAsync(2);

    await assertion;
  });

  it.each([
    [new DOMException('timeout', 'TimeoutError'), 'TIMEOUT'],
    [new Error('stream interrupted'), 'NETWORK_ERROR'],
  ])('maps response stream errors', async (streamError, code) => {
    const fetchMock = vi.fn(async () => errorStream(streamError));

    await expect(
      createClient(fetchMock).getPullRequestDiff(reference),
    ).rejects.toMatchObject({ code });
  });

  it('maps caller cancellation during response streaming', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn(async () =>
      errorStream(new Error('stream interrupted')),
    );

    await expect(
      createClient(fetchMock).getPullRequestDiff(
        reference,
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
