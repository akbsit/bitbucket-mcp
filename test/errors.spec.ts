import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../src/bitbucket/constants';
import {
  BitbucketClientError,
  errorFromStatus,
} from '../src/bitbucket/errors';

describe('Bitbucket errors', () => {
  it('preserves error metadata and cause', () => {
    const cause = new Error('cause');
    const error = new BitbucketClientError('TIMEOUT', 'Timed out', {
      status: 504,
      retryAfterSeconds: 10,
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BitbucketClientError');
    expect(error.code).toBe('TIMEOUT');
    expect(error.status).toBe(504);
    expect(error.retryAfterSeconds).toBe(10);
    expect(error.cause).toBe(cause);
  });

  it.each([
    [HTTP_STATUS.unauthorized, 'AUTHENTICATION_FAILED'],
    [HTTP_STATUS.forbidden, 'PERMISSION_DENIED'],
    [HTTP_STATUS.notFound, 'NOT_FOUND'],
    [HTTP_STATUS.badGateway, 'UPSTREAM_ERROR'],
  ])('maps HTTP status %s to %s', (status, code) => {
    const error = errorFromStatus(status);

    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
  });

  it('includes Retry-After for rate limits', () => {
    const error = errorFromStatus(HTTP_STATUS.tooManyRequests, 60);

    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryAfterSeconds).toBe(60);
  });

  it('supports rate limits without Retry-After', () => {
    const error = errorFromStatus(HTTP_STATUS.tooManyRequests);

    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryAfterSeconds).toBeUndefined();
  });
});
