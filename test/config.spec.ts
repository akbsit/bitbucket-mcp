import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadConfig } from '../src/config';

const requiredEnvironment = {
  BITBUCKET_API_TOKEN: 'token',
  BITBUCKET_API_BASE_URL: 'https://api.bitbucket.org/2.0',
};

describe('loadConfig', () => {
  it('loads required values and applies defaults', () => {
    const config = loadConfig(requiredEnvironment);

    expect(config).toEqual({
      apiToken: 'token',
      apiBaseUrl: 'https://api.bitbucket.org/2.0/',
      requestTimeoutMs: 15_000,
      maxRetries: 2,
      maxPages: 20,
      maxCommits: 1_000,
      maxDiffBytes: 2_000_000,
      maxJsonBytes: 1_000_000,
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('loads configured operational limits', () => {
    const config = loadConfig({
      ...requiredEnvironment,
      BITBUCKET_REQUEST_TIMEOUT_MS: '1000',
      BITBUCKET_MAX_RETRIES: '0',
      BITBUCKET_MAX_PAGES: '1',
      BITBUCKET_MAX_COMMITS: '1',
      BITBUCKET_MAX_DIFF_BYTES: '1024',
      BITBUCKET_MAX_JSON_BYTES: '10000000',
    });

    expect(config).toMatchObject({
      requestTimeoutMs: 1_000,
      maxRetries: 0,
      maxPages: 1,
      maxCommits: 1,
      maxDiffBytes: 1_024,
      maxJsonBytes: 10_000_000,
    });
  });

  it.each([
    [{ ...requiredEnvironment, BITBUCKET_API_TOKEN: '' }, 'API_TOKEN'],
    [
      {
        ...requiredEnvironment,
        BITBUCKET_API_BASE_URL: 'http://example.com',
      },
      'must use HTTPS',
    ],
    [
      {
        ...requiredEnvironment,
        BITBUCKET_API_BASE_URL: 'https://user@example.com/2.0',
      },
      'cannot contain credentials',
    ],
    [
      {
        ...requiredEnvironment,
        BITBUCKET_API_BASE_URL: 'https://example.com/2.0?query=true',
      },
      'cannot contain credentials',
    ],
    [
      { ...requiredEnvironment, BITBUCKET_API_BASE_URL: 'not-a-url' },
      'valid URL',
    ],
    [
      { ...requiredEnvironment, BITBUCKET_MAX_RETRIES: '-1' },
      'must be an integer',
    ],
    [{ ...requiredEnvironment, BITBUCKET_MAX_PAGES: '101' }, 'Too big'],
  ])('rejects invalid environment values', (environment, message) => {
    expect(() => loadConfig(environment)).toThrowError(ConfigurationError);
    expect(() => loadConfig(environment)).toThrow(message);
  });
});
