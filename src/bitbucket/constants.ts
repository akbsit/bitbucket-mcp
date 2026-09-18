export const BITBUCKET_MEDIA_TYPE = Object.freeze({
  json: 'application/json',
  diff: 'text/plain',
});

export const HTTP_STATUS = Object.freeze({
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  tooManyRequests: 429,
  badGateway: 502,
  serviceUnavailable: 503,
  gatewayTimeout: 504,
});

export const RETRYABLE_HTTP_STATUS_CODES: ReadonlySet<number> = new Set([
  HTTP_STATUS.tooManyRequests,
  HTTP_STATUS.badGateway,
  HTTP_STATUS.serviceUnavailable,
  HTTP_STATUS.gatewayTimeout,
]);

export const BITBUCKET_COMMITS_PAGE_LENGTH = 100;
export const BASE_RETRY_DELAY_MS = 250;
export const RETRY_JITTER_MS = 100;
export const MAX_EXPONENTIAL_RETRY_DELAY_MS = 5_000;
export const MAX_RETRY_AFTER_DELAY_MS = 30_000;
