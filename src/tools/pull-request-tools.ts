import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import type { BitbucketClient } from '../bitbucket/client';
import { BitbucketClientError } from '../bitbucket/errors';
import type { PullRequestReference } from '../bitbucket/types';
import type { Logger } from '../logger';

const pullRequestInputSchema = z.object({
  workspace: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe('Bitbucket workspace slug'),
  repo_slug: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe('Bitbucket repository slug'),
  pr_id: z
    .union([
      z
        .string()
        .trim()
        .regex(/^[1-9]\d*$/),
      z.number().int().positive(),
    ])
    .describe('Positive pull request identifier'),
});

const pullRequestOutputSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  state: z.string(),
  author: z
    .object({
      display_name: z.string(),
      account_id: z.string(),
    })
    .nullable(),
  source: z.object({ branch: z.object({ name: z.string() }) }),
  destination: z.object({ branch: z.object({ name: z.string() }) }),
  links: z.object({ html: z.object({ href: z.string() }) }),
});

const commitsOutputSchema = z.object({
  values: z.array(
    z.object({
      hash: z.string(),
      message: z.string(),
      date: z.string(),
      author: z.object({ raw: z.string() }),
    }),
  ),
  fetched_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

const diffOutputSchema = z.object({
  diff: z.string(),
  bytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

type PullRequestInput = z.infer<typeof pullRequestInputSchema>;

function toReference(input: PullRequestInput): PullRequestReference {
  return {
    workspace: input.workspace,
    repoSlug: input.repo_slug,
    prId: String(input.pr_id),
  };
}

function successResult<Payload extends Record<string, unknown>>(
  payload: Payload,
) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function errorResult(error: unknown, logger: Logger) {
  if (error instanceof BitbucketClientError) {
    logger.error('bitbucket_tool_failed', {
      code: error.code,
      status: error.status,
      retry_after_seconds: error.retryAfterSeconds,
    });

    const details: Record<string, unknown> = {
      code: error.code,
      message: error.message,
    };
    if (error.status !== undefined) {
      details.status = error.status;
    }
    if (error.retryAfterSeconds !== undefined) {
      details.retry_after_seconds = error.retryAfterSeconds;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: details }),
        },
      ],
      isError: true as const,
    };
  }

  logger.error('bitbucket_tool_failed', { code: 'INTERNAL_ERROR' });
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'The Bitbucket tool failed unexpectedly.',
          },
        }),
      },
    ],
    isError: true as const,
  };
}

export function registerPullRequestTools(
  server: McpServer,
  client: BitbucketClient,
  logger: Logger,
): void {
  server.registerTool(
    'getPullRequest',
    {
      description: 'Fetch metadata for a Bitbucket Cloud pull request.',
      inputSchema: pullRequestInputSchema,
      outputSchema: pullRequestOutputSchema,
    },
    async (input, context) => {
      try {
        const result = await client.getPullRequest(
          toReference(input),
          context.mcpReq.signal,
        );
        return successResult({ ...result });
      } catch (error) {
        return errorResult(error, logger);
      }
    },
  );

  server.registerTool(
    'getPullRequestCommits',
    {
      description:
        'Fetch commits for a Bitbucket Cloud pull request. Results are bounded and report truncation.',
      inputSchema: pullRequestInputSchema,
      outputSchema: commitsOutputSchema,
    },
    async (input, context) => {
      try {
        const result = await client.getPullRequestCommits(
          toReference(input),
          context.mcpReq.signal,
        );
        return successResult({ ...result, values: [...result.values] });
      } catch (error) {
        return errorResult(error, logger);
      }
    },
  );

  server.registerTool(
    'getPullRequestDiff',
    {
      description:
        'Fetch the unified diff for a Bitbucket Cloud pull request. The result reports size truncation.',
      inputSchema: pullRequestInputSchema,
      outputSchema: diffOutputSchema,
    },
    async (input, context) => {
      try {
        const result = await client.getPullRequestDiff(
          toReference(input),
          context.mcpReq.signal,
        );
        return successResult({ ...result });
      } catch (error) {
        return errorResult(error, logger);
      }
    },
  );
}
