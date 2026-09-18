import { USER_AGENT } from '../app-metadata';
import type { AppConfig } from '../config';
import type { Logger } from '../logger';
import {
  BASE_RETRY_DELAY_MS,
  BITBUCKET_COMMITS_PAGE_LENGTH,
  BITBUCKET_MEDIA_TYPE,
  MAX_EXPONENTIAL_RETRY_DELAY_MS,
  MAX_RETRY_AFTER_DELAY_MS,
  RETRYABLE_HTTP_STATUS_CODES,
  RETRY_JITTER_MS,
} from './constants';
import { BitbucketClientError, errorFromStatus } from './errors';
import {
  commitPageResponseSchema,
  pullRequestResponseSchema,
} from './schemas';
import type {
  PullRequest,
  PullRequestCommit,
  PullRequestCommits,
  PullRequestDiff,
  PullRequestReference,
} from './types';

interface ClientDependencies {
  readonly fetch: typeof fetch;
  readonly logger: Logger;
  readonly random: () => number;
  readonly sleep: (
    milliseconds: number,
    signal?: AbortSignal,
  ) => Promise<void>;
}

interface LimitedText {
  readonly text: string;
  readonly bytes: number;
  readonly truncated: boolean;
}

function defaultSleep(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new Error('Operation cancelled'),
      );
      return;
    }

    const cancel = (): void => {
      clearTimeout(timeout);
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new Error('Operation cancelled'),
      );
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', cancel, { once: true });
    timeout.unref();
  });
}

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return undefined;
  }

  return Math.max(date - Date.now(), 0);
}

function concatenateChunks(
  chunks: readonly Uint8Array[],
  byteLength: number,
): Uint8Array {
  const body = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

async function readLimitedText(
  response: Response,
  maximumBytes: number,
): Promise<LimitedText> {
  if (response.body === null) {
    return { text: '', bytes: 0, truncated: false };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;

  let reading = true;
  while (reading) {
    const { value, done } = await reader.read();
    if (done) {
      reading = false;
      continue;
    }

    const remaining = maximumBytes - bytes;
    if (value.byteLength > remaining) {
      if (remaining > 0) {
        chunks.push(value.subarray(0, remaining));
        bytes += remaining;
      }
      truncated = true;
      await reader.cancel();
      break;
    }

    chunks.push(value);
    bytes += value.byteLength;

    if (bytes === maximumBytes) {
      const next = await reader.read();
      truncated = !next.done;
      if (!next.done) {
        await reader.cancel();
      }
      break;
    }
  }

  const body = concatenateChunks(chunks, bytes);
  return { text: new TextDecoder().decode(body), bytes, truncated };
}

export class BitbucketClient {
  readonly #config: AppConfig;
  readonly #dependencies: ClientDependencies;
  readonly #apiBaseUrl: URL;

  constructor(
    config: AppConfig,
    dependencies: Partial<ClientDependencies> &
      Pick<ClientDependencies, 'logger'>,
  ) {
    this.#config = config;
    this.#apiBaseUrl = new URL(config.apiBaseUrl);
    this.#dependencies = {
      fetch: dependencies.fetch ?? globalThis.fetch,
      logger: dependencies.logger,
      random: dependencies.random ?? Math.random,
      sleep: dependencies.sleep ?? defaultSleep,
    };
  }

  async getPullRequest(
    reference: PullRequestReference,
    signal?: AbortSignal,
  ): Promise<PullRequest> {
    const payload = await this.#requestJson(
      this.#buildPullRequestUrl(reference),
      signal,
    );
    const parsed = pullRequestResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new BitbucketClientError(
        'BAD_RESPONSE',
        'Bitbucket returned malformed pull request data.',
      );
    }

    const data = parsed.data;
    return {
      id: data.id,
      title: data.title,
      description: data.description ?? '',
      state: data.state,
      author:
        data.author === null || data.author === undefined
          ? null
          : {
              display_name: data.author.display_name ?? '',
              account_id: data.author.account_id ?? '',
            },
      source: { branch: { name: data.source.branch.name } },
      destination: {
        branch: { name: data.destination.branch.name },
      },
      links: { html: { href: data.links.html.href } },
    };
  }

  async getPullRequestCommits(
    reference: PullRequestReference,
    signal?: AbortSignal,
  ): Promise<PullRequestCommits> {
    const initialUrl = this.#buildPullRequestUrl(reference, 'commits');
    initialUrl.searchParams.set(
      'pagelen',
      String(BITBUCKET_COMMITS_PAGE_LENGTH),
    );

    const commits: PullRequestCommit[] = [];
    const visitedUrls = new Set<string>();
    let nextUrl: URL | null = initialUrl;
    let pages = 0;
    let truncated = false;

    while (
      nextUrl !== null &&
      pages < this.#config.maxPages &&
      commits.length < this.#config.maxCommits
    ) {
      const safeUrl = this.#assertTrustedUrl(nextUrl);
      if (visitedUrls.has(safeUrl.href)) {
        throw new BitbucketClientError(
          'BAD_RESPONSE',
          'Bitbucket returned a repeated pagination URL.',
        );
      }

      visitedUrls.add(safeUrl.href);
      const payload = await this.#requestJson(safeUrl, signal);
      const parsed = commitPageResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new BitbucketClientError(
          'BAD_RESPONSE',
          'Bitbucket returned malformed commit data.',
        );
      }

      const remaining = this.#config.maxCommits - commits.length;
      commits.push(
        ...parsed.data.values.slice(0, remaining).map((commit) => ({
          hash: commit.hash,
          message: commit.message ?? '',
          date: commit.date ?? '',
          author: { raw: commit.author?.raw ?? '' },
        })),
      );
      pages += 1;

      if (parsed.data.values.length > remaining) {
        truncated = true;
        nextUrl = null;
      } else if (
        parsed.data.next === null ||
        parsed.data.next === undefined
      ) {
        nextUrl = null;
      } else {
        nextUrl = new URL(parsed.data.next, this.#apiBaseUrl);
      }
    }

    if (nextUrl !== null) {
      truncated = true;
    }

    return { values: commits, fetched_count: commits.length, truncated };
  }

  async getPullRequestDiff(
    reference: PullRequestReference,
    signal?: AbortSignal,
  ): Promise<PullRequestDiff> {
    const response = await this.#fetchWithRetry(
      this.#buildPullRequestUrl(reference, 'diff'),
      BITBUCKET_MEDIA_TYPE.diff,
      signal,
    );
    const result = await this.#readResponse(
      response,
      this.#config.maxDiffBytes,
      signal,
    );
    return {
      diff: result.text,
      bytes: result.bytes,
      truncated: result.truncated,
    };
  }

  #buildPullRequestUrl(
    reference: PullRequestReference,
    suffix?: string,
  ): URL {
    const path = [
      'repositories',
      reference.workspace,
      reference.repoSlug,
      'pullrequests',
      reference.prId,
      suffix,
    ]
      .filter((segment): segment is string => segment !== undefined)
      .map(encodeURIComponent)
      .join('/');

    return new URL(path, this.#apiBaseUrl);
  }

  #assertTrustedUrl(url: URL): URL {
    if (
      url.protocol !== 'https:' ||
      url.origin !== this.#apiBaseUrl.origin ||
      !url.pathname.startsWith(this.#apiBaseUrl.pathname)
    ) {
      throw new BitbucketClientError(
        'UNSAFE_UPSTREAM_URL',
        'Bitbucket returned an unsafe pagination URL.',
      );
    }

    return url;
  }

  async #requestJson(url: URL, signal?: AbortSignal): Promise<unknown> {
    const response = await this.#fetchWithRetry(
      url,
      BITBUCKET_MEDIA_TYPE.json,
      signal,
    );
    const result = await this.#readResponse(
      response,
      this.#config.maxJsonBytes,
      signal,
    );
    if (result.truncated) {
      throw new BitbucketClientError(
        'RESPONSE_TOO_LARGE',
        'The Bitbucket JSON response exceeded the configured size limit.',
      );
    }

    try {
      return JSON.parse(result.text) as unknown;
    } catch (error) {
      throw new BitbucketClientError(
        'BAD_RESPONSE',
        'Bitbucket returned invalid JSON.',
        {
          cause: error,
        },
      );
    }
  }

  async #readResponse(
    response: Response,
    maximumBytes: number,
    callerSignal?: AbortSignal,
  ): Promise<LimitedText> {
    try {
      return await readLimitedText(response, maximumBytes);
    } catch (error) {
      if (callerSignal?.aborted === true) {
        throw new BitbucketClientError(
          'CANCELLED',
          'The Bitbucket request was cancelled.',
          {
            cause: error,
          },
        );
      }

      if (
        error instanceof DOMException &&
        ['AbortError', 'TimeoutError'].includes(error.name)
      ) {
        throw new BitbucketClientError(
          'TIMEOUT',
          'The Bitbucket request timed out.',
          {
            cause: error,
          },
        );
      }

      throw new BitbucketClientError(
        'NETWORK_ERROR',
        'The Bitbucket response stream was interrupted.',
        { cause: error },
      );
    }
  }

  async #fetchWithRetry(
    url: URL,
    accept: string,
    callerSignal?: AbortSignal,
  ): Promise<Response> {
    const safeUrl = this.#assertTrustedUrl(url);

    for (
      let attempt = 0;
      attempt <= this.#config.maxRetries;
      attempt += 1
    ) {
      const timeoutSignal = AbortSignal.timeout(
        this.#config.requestTimeoutMs,
      );
      const requestSignal =
        callerSignal === undefined
          ? timeoutSignal
          : AbortSignal.any([callerSignal, timeoutSignal]);

      try {
        const response = await this.#dependencies.fetch(safeUrl, {
          method: 'GET',
          headers: {
            Accept: accept,
            Authorization: `Bearer ${this.#config.apiToken}`,
            'User-Agent': USER_AGENT,
          },
          redirect: 'error',
          signal: requestSignal,
        });

        if (response.ok) {
          return response;
        }

        const retryAfterMs = parseRetryAfter(
          response.headers.get('retry-after'),
        );
        if (
          RETRYABLE_HTTP_STATUS_CODES.has(response.status) &&
          attempt < this.#config.maxRetries
        ) {
          await response.body?.cancel();
          const delayMs =
            retryAfterMs === undefined
              ? Math.min(
                  BASE_RETRY_DELAY_MS * 2 ** attempt +
                    Math.floor(
                      this.#dependencies.random() * RETRY_JITTER_MS,
                    ),
                  MAX_EXPONENTIAL_RETRY_DELAY_MS,
                )
              : Math.min(retryAfterMs, MAX_RETRY_AFTER_DELAY_MS);
          this.#dependencies.logger.warn('bitbucket_request_retry', {
            attempt: attempt + 1,
            status: response.status,
            delay_ms: delayMs,
          });
          await this.#dependencies.sleep(delayMs, callerSignal);
          continue;
        }

        await response.body?.cancel();
        throw errorFromStatus(
          response.status,
          retryAfterMs === undefined
            ? undefined
            : Math.ceil(retryAfterMs / 1_000),
        );
      } catch (error) {
        if (error instanceof BitbucketClientError) {
          throw error;
        }

        if (callerSignal?.aborted === true) {
          throw new BitbucketClientError(
            'CANCELLED',
            'The Bitbucket request was cancelled.',
            {
              cause: error,
            },
          );
        }

        if (timeoutSignal.aborted) {
          throw new BitbucketClientError(
            'TIMEOUT',
            'The Bitbucket request timed out.',
            {
              cause: error,
            },
          );
        }

        if (attempt < this.#config.maxRetries) {
          const delayMs = Math.min(
            BASE_RETRY_DELAY_MS * 2 ** attempt +
              Math.floor(this.#dependencies.random() * RETRY_JITTER_MS),
            MAX_EXPONENTIAL_RETRY_DELAY_MS,
          );
          this.#dependencies.logger.warn('bitbucket_network_retry', {
            attempt: attempt + 1,
            delay_ms: delayMs,
          });
          await this.#dependencies.sleep(delayMs, callerSignal);
          continue;
        }

        throw new BitbucketClientError(
          'NETWORK_ERROR',
          'Unable to reach Bitbucket Cloud.',
          {
            cause: error,
          },
        );
      }
    }

    throw new BitbucketClientError(
      'NETWORK_ERROR',
      'Unable to reach Bitbucket Cloud.',
    );
  }
}
