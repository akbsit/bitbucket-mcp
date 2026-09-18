import { HTTP_STATUS } from './constants';

type BitbucketErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'BAD_RESPONSE'
  | 'CANCELLED'
  | 'NETWORK_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'RESPONSE_TOO_LARGE'
  | 'TIMEOUT'
  | 'UNSAFE_UPSTREAM_URL'
  | 'UPSTREAM_ERROR';

export class BitbucketClientError extends Error {
  override readonly name = 'BitbucketClientError';
  readonly code: BitbucketErrorCode;
  readonly status: number | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: BitbucketErrorCode,
    message: string,
    options: {
      status?: number;
      retryAfterSeconds?: number;
      cause?: unknown;
    } = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.code = code;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function errorFromStatus(
  status: number,
  retryAfterSeconds?: number,
): BitbucketClientError {
  if (status === HTTP_STATUS.unauthorized) {
    return new BitbucketClientError(
      'AUTHENTICATION_FAILED',
      'Bitbucket rejected the API token. Verify that it is valid and has not expired.',
      { status },
    );
  }

  if (status === HTTP_STATUS.forbidden) {
    return new BitbucketClientError(
      'PERMISSION_DENIED',
      'The API token does not have permission to access this Bitbucket resource.',
      { status },
    );
  }

  if (status === HTTP_STATUS.notFound) {
    return new BitbucketClientError(
      'NOT_FOUND',
      'The requested Bitbucket resource was not found.',
      {
        status,
      },
    );
  }

  if (status === HTTP_STATUS.tooManyRequests) {
    const options =
      retryAfterSeconds === undefined
        ? { status }
        : { status, retryAfterSeconds };
    return new BitbucketClientError(
      'RATE_LIMITED',
      'Bitbucket rate-limited the request. Retry later.',
      options,
    );
  }

  return new BitbucketClientError(
    'UPSTREAM_ERROR',
    `Bitbucket returned an unexpected HTTP ${String(status)} response.`,
    { status },
  );
}
