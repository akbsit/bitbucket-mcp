#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { BitbucketClient } from './bitbucket/client';
import { ConfigurationError, loadConfig } from './config';
import { logger } from './logger';
import { createServer } from './server';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new BitbucketClient(config, { logger });
  const server = createServer(client, logger);
  const transport = new StdioServerTransport();
  let closing = false;

  const close = async (signal: string): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    logger.warn('server_shutdown', { signal });
    await server.close();
  };

  const handleSignal = (signal: string): void => {
    void close(signal).catch((error: unknown) => {
      logger.error('server_shutdown_failed', {
        signal,
        error_type: error instanceof Error ? error.name : 'UnknownError',
      });
      process.exitCode = 1;
    });
  };

  process.once('SIGINT', () => {
    handleSignal('SIGINT');
  });
  process.once('SIGTERM', () => {
    handleSignal('SIGTERM');
  });

  await server.connect(transport);
}

void main().catch((error: unknown) => {
  logger.error('server_start_failed', {
    error_type: error instanceof Error ? error.name : 'UnknownError',
    error_message:
      error instanceof ConfigurationError ? error.message : undefined,
  });
  process.exitCode = 1;
});
