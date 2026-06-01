import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getStorageProvider: vi.fn(),
}));

vi.mock('../index.js', async () => {
  const actual = await vi.importActual('../index.js');
  return {
    ...actual,
    getStorageProvider: mocks.getStorageProvider,
  };
});

import { getFileWithFallback } from '../redundancy.js';

describe('storage redundancy fallback timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the default provider directly when fallback is disabled', async () => {
    const defaultProvider = {
      getFile: vi.fn(async () => new Response('direct-ok', { status: 200 })),
    };

    mocks.getStorageProvider.mockImplementation(() => defaultProvider);

    const env = {
      STORAGE_FALLBACK_ENABLED: 'false',
    };

    const response = await getFileWithFallback(
      env,
      'file-1',
      new Request('https://example.com/file-1'),
      null
    );

    expect(await response.text()).toBe('direct-ok');
    expect(mocks.getStorageProvider).toHaveBeenCalledTimes(1);
    expect(mocks.getStorageProvider).toHaveBeenCalledWith(env);
    expect(defaultProvider.getFile).toHaveBeenCalledTimes(1);
  });

  it('falls back to the next provider when the first provider exceeds the env timeout', async () => {
    const firstProvider = {
      getFile: vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(new Response('late-primary', { status: 200 })), 50);
          })
      ),
    };
    const secondProvider = {
      getFile: vi.fn(async () => new Response('fallback-ok', { status: 200 })),
    };
    const thirdProvider = {
      getFile: vi.fn(async () => new Response('unused', { status: 200 })),
    };

    mocks.getStorageProvider.mockImplementation((_env, providerName) => {
      if (providerName === 'r2') return firstProvider;
      if (providerName === 's3') return secondProvider;
      if (providerName === 'telegram') return thirdProvider;
      return firstProvider;
    });

    const env = {
      STORAGE_FALLBACK_ENABLED: 'true',
      STORAGE_FALLBACK_TIMEOUT: '5',
    };

    const response = await getFileWithFallback(
      env,
      'file-1',
      new Request('https://example.com/file-1'),
      null
    );

    expect(await response.text()).toBe('fallback-ok');
    expect(firstProvider.getFile).toHaveBeenCalledTimes(1);
    // 主存储超时后，所有镜像同时竞速请求
    expect(secondProvider.getFile).toHaveBeenCalledTimes(1);
  });
});
