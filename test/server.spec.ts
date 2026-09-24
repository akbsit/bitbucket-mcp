import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import type { BitbucketClient } from '../src/bitbucket/client';
import type { Logger } from '../src/logger';
import { createServer } from '../src/server';

describe('createServer', () => {
  it('creates an MCP server and registers its tools', () => {
    const server = createServer({} as BitbucketClient, {
      warn() {},
      error() {},
    } satisfies Logger);

    expect(server).toBeInstanceOf(McpServer);
  });
});
