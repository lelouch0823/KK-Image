import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache } from '../cache.js';

describe('cache middleware helpers', () => {
  let deleteMock;

  beforeEach(() => {
    deleteMock = vi.fn(async () => false);
    globalThis.caches = {
      default: {
        delete: deleteMock,
      },
    };
  });

  it('invalidates cache entries created with the json Accept header key', async () => {
    await invalidateCache('https://example.com/api/manage/customers?limit=20&page=1');

    expect(deleteMock).toHaveBeenCalledWith(expect.any(Request));

    const request = deleteMock.mock.calls[0][0];
    expect(request.url).toBe('https://example.com/api/manage/customers?limit=20&page=1');
    expect(request.headers.get('Accept')).toBe('application/json');
  });
});
