import { McpServer } from '@modelcontextprotocol/server';
import { SERVER_NAME, SERVER_VERSION } from './app-metadata';
import type { BitbucketClient } from './bitbucket/client';
import type { Logger } from './logger';
import {
  type CommentFooterConfig,
  registerPullRequestTools,
} from './tools/pull-request-tools';

export function createServer(
  clients: Map<string, BitbucketClient>,
  logger: Logger,
  footerConfig?: CommentFooterConfig,
): McpServer {
  const profileList = [...clients.keys()].join(', ');
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        `This server provides Bitbucket Cloud pull request data and allows posting comments. ` +
        `Available credential profiles: ${profileList}. ` +
        `Pass "profile" in tool arguments to select one (default: "default"). ` +
        `Read results can be truncated when configured safety limits are reached.`,
    },
  );

  registerPullRequestTools(server, clients, logger, footerConfig);
  return server;
}
