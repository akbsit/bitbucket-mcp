import type { McpServer } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BitbucketClient } from '../src/bitbucket/client';
import { BitbucketClientError } from '../src/bitbucket/errors';
import type { Logger } from '../src/logger';
import { registerPullRequestTools } from '../src/tools/pull-request-tools';

type ToolHandler = (
  input: Record<string, unknown>,
  context: { mcpReq: { signal: AbortSignal } },
) => Promise<{
  content: readonly { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}>;

describe('pull request tools', () => {
  const handlers = new Map<string, ToolHandler>();
  const registerTool = vi.fn(
    (name: string, _configuration: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    },
  );
  const client = {
    getPullRequest: vi.fn(),
    getPullRequestCommits: vi.fn(),
    getPullRequestDiff: vi.fn(),
  };
  const logger: Logger = {
    warn: vi.fn(),
    error: vi.fn(),
  };
  const context = {
    mcpReq: { signal: new AbortController().signal },
  };

  beforeEach(() => {
    handlers.clear();
    registerTool.mockClear();
    vi.clearAllMocks();
    registerPullRequestTools(
      { registerTool } as unknown as McpServer,
      client as unknown as BitbucketClient,
      logger,
    );
  });

  it('registers all supported tools', () => {
    expect([...handlers.keys()]).toEqual([
      'getPullRequest',
      'getPullRequestCommits',
      'getPullRequestDiff',
    ]);
  });

  it('returns pull request metadata', async () => {
    const payload = {
      id: 42,
      title: 'Title',
      description: 'Description',
      state: 'OPEN',
      author: null,
      source: { branch: { name: 'feature' } },
      destination: { branch: { name: 'main' } },
      links: { html: { href: 'https://example.com/pr/42' } },
    };
    client.getPullRequest.mockResolvedValueOnce(payload);

    const result = await handlers.get('getPullRequest')?.(
      { workspace: 'workspace', repo_slug: 'repository', pr_id: 42 },
      context,
    );

    expect(client.getPullRequest).toHaveBeenCalledWith(
      { workspace: 'workspace', repoSlug: 'repository', prId: '42' },
      context.mcpReq.signal,
    );
    expect(result?.structuredContent).toEqual(payload);
    expect(JSON.parse(result?.content[0]?.text ?? '')).toEqual(payload);
  });

  it('returns commit results', async () => {
    const payload = { values: [], fetched_count: 0, truncated: false };
    client.getPullRequestCommits.mockResolvedValueOnce(payload);

    const result = await handlers.get('getPullRequestCommits')?.(
      { workspace: 'workspace', repo_slug: 'repository', pr_id: '7' },
      context,
    );

    expect(result?.structuredContent).toEqual(payload);
  });

  it('returns diff results', async () => {
    const payload = { diff: 'diff', bytes: 4, truncated: false };
    client.getPullRequestDiff.mockResolvedValueOnce(payload);

    const result = await handlers.get('getPullRequestDiff')?.(
      { workspace: 'workspace', repo_slug: 'repository', pr_id: 7 },
      context,
    );

    expect(result?.structuredContent).toEqual(payload);
  });

  it('returns safe client errors with metadata', async () => {
    client.getPullRequest.mockRejectedValueOnce(
      new BitbucketClientError('RATE_LIMITED', 'Retry later.', {
        status: 429,
        retryAfterSeconds: 60,
      }),
    );

    const result = await handlers.get('getPullRequest')?.(
      { workspace: 'workspace', repo_slug: 'repository', pr_id: 1 },
      context,
    );

    expect(result?.isError).toBe(true);
    expect(JSON.parse(result?.content[0]?.text ?? '')).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Retry later.',
        status: 429,
        retry_after_seconds: 60,
      },
    });
    expect(logger.error).toHaveBeenCalledWith('bitbucket_tool_failed', {
      code: 'RATE_LIMITED',
      status: 429,
      retry_after_seconds: 60,
    });
  });

  it('hides unexpected error details', async () => {
    client.getPullRequestDiff.mockRejectedValueOnce(
      new Error('sensitive details'),
    );

    const result = await handlers.get('getPullRequestDiff')?.(
      { workspace: 'workspace', repo_slug: 'repository', pr_id: 1 },
      context,
    );

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).not.toContain('sensitive details');
    expect(logger.error).toHaveBeenCalledWith('bitbucket_tool_failed', {
      code: 'INTERNAL_ERROR',
    });
  });

  it('returns client errors without optional metadata', async () => {
    client.getPullRequestCommits.mockRejectedValueOnce(
      new BitbucketClientError('BAD_RESPONSE', 'Malformed response.'),
    );

    const result = await handlers.get('getPullRequestCommits')?.(
      { workspace: 'workspace', repo_slug: 'repository', pr_id: 1 },
      context,
    );

    expect(JSON.parse(result?.content[0]?.text ?? '')).toEqual({
      error: {
        code: 'BAD_RESPONSE',
        message: 'Malformed response.',
      },
    });
  });
});
