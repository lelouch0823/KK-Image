import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from '../http-core';

describe('http-core request', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throws normalized error for non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: '权限不足: products:manage' }),
      statusText: 'Forbidden',
    });

    await expect(request('/api/manage/products')).rejects.toMatchObject({
      status: 403,
      message: '权限不足: products:manage',
    });
  });

  it('keeps the request timeout active when a caller signal is provided', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    let settled;
    globalThis.fetch = vi.fn((_url, options = {}) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    request('/api/manage/products', { signal: caller.signal, timeout: 25 }).catch((error) => {
      settled = error;
    });

    await vi.advanceTimersByTimeAsync(25);
    await Promise.resolve();

    expect(settled).toMatchObject({
      code: 'TIMEOUT',
      message: '请求超时',
    });
    expect(caller.signal.aborted).toBe(false);
  });

  it('does not translate caller aborts into timeout errors', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    globalThis.fetch = vi.fn((_url, options = {}) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('Caller aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const pending = request('/api/manage/products', { signal: caller.signal, timeout: 100 });
    caller.abort();

    await expect(pending).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Caller aborted',
    });
  });
});
