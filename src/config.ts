import { z } from 'zod/v4';

const CONFIGURATION_DEFAULTS = Object.freeze({
  requestTimeoutMs: 15_000,
  maxRetries: 2,
  maxPages: 20,
  maxCommits: 1_000,
  maxDiffBytes: 2_000_000,
  maxJsonBytes: 1_000_000,
});

const CONFIGURATION_LIMITS = Object.freeze({
  requestTimeoutMs: { minimum: 1_000, maximum: 120_000 },
  maxRetries: { minimum: 0, maximum: 5 },
  maxPages: { minimum: 1, maximum: 100 },
  maxCommits: { minimum: 1, maximum: 5_000 },
  responseBytes: { minimum: 1_024, maximum: 10_000_000 },
});

const boundedInteger = (
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${name} must be an integer`)
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum))
    .default(defaultValue);

const environmentSchema = z.object({
  BITBUCKET_API_TOKEN: z
    .string()
    .trim()
    .min(1, 'BITBUCKET_API_TOKEN is required'),
  BITBUCKET_API_BASE_URL: z
    .string()
    .trim()
    .pipe(z.url({ error: 'BITBUCKET_API_BASE_URL must be a valid URL' }))
    .transform((value, context) => {
      const url = new URL(value);
      if (url.protocol !== 'https:') {
        context.addIssue({
          code: 'custom',
          message: 'BITBUCKET_API_BASE_URL must use HTTPS',
        });
        return z.NEVER;
      }
      if (
        url.username !== '' ||
        url.password !== '' ||
        url.search !== '' ||
        url.hash !== ''
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'BITBUCKET_API_BASE_URL cannot contain credentials, query parameters, or a fragment',
        });
        return z.NEVER;
      }

      url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
      return url.toString();
    }),
  BITBUCKET_REQUEST_TIMEOUT_MS: boundedInteger(
    'BITBUCKET_REQUEST_TIMEOUT_MS',
    CONFIGURATION_DEFAULTS.requestTimeoutMs,
    CONFIGURATION_LIMITS.requestTimeoutMs.minimum,
    CONFIGURATION_LIMITS.requestTimeoutMs.maximum,
  ),
  BITBUCKET_MAX_RETRIES: boundedInteger(
    'BITBUCKET_MAX_RETRIES',
    CONFIGURATION_DEFAULTS.maxRetries,
    CONFIGURATION_LIMITS.maxRetries.minimum,
    CONFIGURATION_LIMITS.maxRetries.maximum,
  ),
  BITBUCKET_MAX_PAGES: boundedInteger(
    'BITBUCKET_MAX_PAGES',
    CONFIGURATION_DEFAULTS.maxPages,
    CONFIGURATION_LIMITS.maxPages.minimum,
    CONFIGURATION_LIMITS.maxPages.maximum,
  ),
  BITBUCKET_MAX_COMMITS: boundedInteger(
    'BITBUCKET_MAX_COMMITS',
    CONFIGURATION_DEFAULTS.maxCommits,
    CONFIGURATION_LIMITS.maxCommits.minimum,
    CONFIGURATION_LIMITS.maxCommits.maximum,
  ),
  BITBUCKET_MAX_DIFF_BYTES: boundedInteger(
    'BITBUCKET_MAX_DIFF_BYTES',
    CONFIGURATION_DEFAULTS.maxDiffBytes,
    CONFIGURATION_LIMITS.responseBytes.minimum,
    CONFIGURATION_LIMITS.responseBytes.maximum,
  ),
  BITBUCKET_MAX_JSON_BYTES: boundedInteger(
    'BITBUCKET_MAX_JSON_BYTES',
    CONFIGURATION_DEFAULTS.maxJsonBytes,
    CONFIGURATION_LIMITS.responseBytes.minimum,
    CONFIGURATION_LIMITS.responseBytes.maximum,
  ),
});

export interface AppConfig {
  readonly apiToken: string;
  readonly apiBaseUrl: string;
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly maxPages: number;
  readonly maxCommits: number;
  readonly maxDiffBytes: number;
  readonly maxJsonBytes: number;
}

export class ConfigurationError extends Error {
  override readonly name = 'ConfigurationError';
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) =>
          `${issue.path.join('.') || 'environment'}: ${issue.message}`,
      )
      .join('; ');
    throw new ConfigurationError(`Invalid configuration: ${details}`);
  }

  return Object.freeze({
    apiToken: result.data.BITBUCKET_API_TOKEN,
    apiBaseUrl: result.data.BITBUCKET_API_BASE_URL,
    requestTimeoutMs: result.data.BITBUCKET_REQUEST_TIMEOUT_MS,
    maxRetries: result.data.BITBUCKET_MAX_RETRIES,
    maxPages: result.data.BITBUCKET_MAX_PAGES,
    maxCommits: result.data.BITBUCKET_MAX_COMMITS,
    maxDiffBytes: result.data.BITBUCKET_MAX_DIFF_BYTES,
    maxJsonBytes: result.data.BITBUCKET_MAX_JSON_BYTES,
  });
}
