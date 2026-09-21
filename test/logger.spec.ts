import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../src/logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['warn', 'warning_event'],
    ['error', 'error_event'],
  ] as const)('writes structured %s entries to stderr', (level, event) => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    logger[level](event, { count: 2, enabled: true });

    expect(write).toHaveBeenCalledOnce();
    const entry = JSON.parse(String(write.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(entry).toMatchObject({ level, event, count: 2, enabled: true });
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it('supports entries without fields', () => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    logger.warn('warning_event');

    expect(write).toHaveBeenCalledOnce();
  });
});
