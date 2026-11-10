import { describe, expect, it } from 'vitest';
import {
  ConfigurationError,
  loadConfig,
  loadProfiles,
} from '../src/config';

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
      maxComments: 500,
      commentFooter: true,
      agentName: 'agent',
      maxDiffBytes: 2_000_000,
      maxJsonBytes: 1_000_000,
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('loads comment footer settings', () => {
    const config = loadConfig({
      ...requiredEnvironment,
      BITBUCKET_COMMENT_FOOTER: 'false',
      BITBUCKET_AGENT_NAME: 'Claude Engineer Agent',
    });

    expect(config.commentFooter).toBe(false);
    expect(config.agentName).toBe('Claude Engineer Agent');
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

describe('loadProfiles', () => {
  it('creates a default profile from legacy BITBUCKET_API_TOKEN', () => {
    const profiles = loadProfiles(requiredEnvironment);

    expect(profiles.size).toBe(1);
    expect(profiles.has('default')).toBe(true);
    expect(profiles.get('default')?.apiToken).toBe('token');
  });

  it('creates named profiles from BITBUCKET_PROFILE_<NAME>_TOKEN', () => {
    const profiles = loadProfiles({
      BITBUCKET_API_BASE_URL: 'https://api.bitbucket.org/2.0',
      BITBUCKET_PROFILE_WORK_TOKEN: 'work-token',
      BITBUCKET_PROFILE_PERSONAL_TOKEN: 'personal-token',
    });

    expect(profiles.size).toBe(2);
    expect(profiles.get('work')?.apiToken).toBe('work-token');
    expect(profiles.get('personal')?.apiToken).toBe('personal-token');
  });

  it('creates both default and named profiles when both are present', () => {
    const profiles = loadProfiles({
      ...requiredEnvironment,
      BITBUCKET_PROFILE_WORK_TOKEN: 'work-token',
    });

    expect(profiles.size).toBe(2);
    expect(profiles.get('default')?.apiToken).toBe('token');
    expect(profiles.get('work')?.apiToken).toBe('work-token');
  });

  it('named profile inherits shared BASE_URL when no per-profile URL is set', () => {
    const profiles = loadProfiles({
      BITBUCKET_API_BASE_URL: 'https://api.bitbucket.org/2.0',
      BITBUCKET_PROFILE_WORK_TOKEN: 'work-token',
    });

    expect(profiles.get('work')?.apiBaseUrl).toBe(
      'https://api.bitbucket.org/2.0/',
    );
  });

  it('named profile uses its own BASE_URL when provided', () => {
    const profiles = loadProfiles({
      BITBUCKET_API_BASE_URL: 'https://api.bitbucket.org/2.0',
      BITBUCKET_PROFILE_WORK_TOKEN: 'work-token',
      BITBUCKET_PROFILE_WORK_BASE_URL: 'https://custom.example.com/2.0',
    });

    expect(profiles.get('work')?.apiBaseUrl).toBe(
      'https://custom.example.com/2.0/',
    );
  });

  it('lowercases profile names from env var keys', () => {
    const profiles = loadProfiles({
      BITBUCKET_API_BASE_URL: 'https://api.bitbucket.org/2.0',
      BITBUCKET_PROFILE_MYTEAM_TOKEN: 'team-token',
    });

    expect(profiles.has('myteam')).toBe(true);
  });

  it('throws ConfigurationError when no credentials are found', () => {
    expect(() => loadProfiles({})).toThrowError(ConfigurationError);
    expect(() => loadProfiles({})).toThrow('No Bitbucket credentials');
  });

  it('throws ConfigurationError for invalid named profile token', () => {
    expect(() =>
      loadProfiles({
        BITBUCKET_API_BASE_URL: 'https://api.bitbucket.org/2.0',
        BITBUCKET_PROFILE_WORK_TOKEN: '',
      }),
    ).toThrowError(ConfigurationError);
  });

  it('throws ConfigurationError when BITBUCKET_PROFILE_DEFAULT_TOKEN conflicts with BITBUCKET_API_TOKEN', () => {
    expect(() =>
      loadProfiles({
        ...requiredEnvironment,
        BITBUCKET_PROFILE_DEFAULT_TOKEN: 'other-token',
      }),
    ).toThrowError(ConfigurationError);
    expect(() =>
      loadProfiles({
        ...requiredEnvironment,
        BITBUCKET_PROFILE_DEFAULT_TOKEN: 'other-token',
      }),
    ).toThrow('conflicts');
  });
});
