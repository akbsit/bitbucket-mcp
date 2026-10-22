import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import type { BitbucketClient } from '../src/bitbucket/client';
import type { Logger } from '../src/logger';
import { createServer } from '../src/server';

const logger: Logger = { warn() {}, error() {} };
const stubClient = {} as BitbucketClient;

describe('createServer', () => {
  it('creates an MCP server with a single-entry clients map', () => {
    const clients = new Map([['default', stubClient]]);
    const server = createServer(clients, logger);

    expect(server).toBeInstanceOf(McpServer);
  });

  it('creates an MCP server with a multi-profile clients map', () => {
    const clients = new Map([
      ['default', stubClient],
      ['work', stubClient],
    ]);
    const server = createServer(clients, logger);

    expect(server).toBeInstanceOf(McpServer);
  });
});
