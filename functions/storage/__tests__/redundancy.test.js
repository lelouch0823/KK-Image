import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getStorageProvider: vi.fn(),
  getFallbackChain: vi.fn(),
  routerInstance: {
    selectStorage: vi.fn(),
    getMirrors: vi.fn(),
    isAsyncMirror: vi.fn(),
  },
  SmartRouter: vi.fn(),
}));

mocks.SmartRouter.mockImplementation(() => mocks.routerInstance);

vi.mock('../index.js', async () => {
  const actual = await vi.importActual('../index.js');
  return {
    ...actual,
    getStorageProvider: mocks.getStorageProvider,
  };
});

vi.mock('../router.js', async () => {
  const actual = await vi.importActual('../router.js');
  return {
    ...actual,
    SmartRouter: mocks.SmartRouter,
    getFallbackChain: mocks.getFallbackChain,
  };
});

import { RedundancyManager, getFileWithFallback } from '../redundancy.js';

function createDbStatement({ results = [] } = {}) {
  return {
    bind: vi.fn(() => ({
      all: vi.fn(async () => ({ results })),
      run: vi.fn(async () => ({ success: true })),
    })),
  };
}

describe('storage redundancy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    mocks.SmartRouter.mockImplementation(() => mocks.routerInstance);
    mocks.getStorageProvider.mockReset();
    mocks.getFallbackChain.mockReset();
    mocks.routerInstance.selectStorage.mockReset().mockReturnValue('r2');
    mocks.routerInstance.getMirrors.mockReset().mockReturnValue([]);
    mocks.routerInstance.isAsyncMirror.mockReset().mockReturnValue(false);
  });

  it('throws when the selected primary provider is missing', async () => {
    mocks.getStorageProvider.mockReturnValue(null);

    const manager = new RedundancyManager({});

    await expect(manager.upload({ name: 'demo.png' }, {})).rejects.toThrow(
      "Storage provider 'r2' not found"
    );
  });

  it('rethrows primary upload failures and logs them', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getStorageProvider.mockReturnValue({
      upload: vi.fn(async () => ({ success: false, error: 'broken' })),
    });

    const manager = new RedundancyManager({});

    await expect(manager.upload({ name: 'demo.png' }, {})).rejects.toThrow('broken');
    expect(errorSpy).toHaveBeenCalledWith(
      'Upload to primary storage (r2) failed:',
      expect.any(Error)
    );
  });

  it('records primary metadata even when no mirrors are configured', async () => {
    const primaryProvider = {
      upload: vi.fn(async () => ({ success: true, fileId: 'primary-1' })),
    };
    mocks.getStorageProvider.mockReturnValue(primaryProvider);

    const manager = new RedundancyManager({});
    const result = await manager.upload({ name: 'demo.png' }, {});

    expect(result.metadata.storage).toEqual({
      primary: 'r2',
      primaryId: 'primary-1',
    });
  });

  it('handles mirrors asynchronously and returns immediately after primary upload', async () => {
    const primaryProvider = {
      upload: vi.fn(async () => ({ success: true, fileId: 'primary-1', metadata: { legacy: true } })),
    };
    const s3Provider = {
      upload: vi.fn(async () => ({ success: true, fileId: 'mirror-s3' })),
    };
    const telegramProvider = {
      upload: vi.fn(async () => {
        throw new Error('telegram down');
      }),
    };

    mocks.routerInstance.getMirrors.mockReturnValue(['r2', 's3', 'telegram']);
    mocks.getStorageProvider.mockImplementation((_env, providerName) => {
      if (providerName === 'r2') return primaryProvider;
      if (providerName === 's3') return s3Provider;
      if (providerName === 'telegram') return telegramProvider;
      return null;
    });

    const manager = new RedundancyManager({});
    const updateSpy = vi.spyOn(manager, '_updateMirrorStatus').mockResolvedValue();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await manager.upload({ name: 'demo.png' }, {});

    // 镜像上传现在是异步的，响应立即返回空 mirrors 数组
    expect(result.metadata.storage).toEqual({
      primary: 'r2',
      primaryId: 'primary-1',
      mirrors: [],
    });
    // 异步镜像任务已通过 _mirrorAsync 调度，不在此处验证异步结果
  });

  it('schedules async mirrors through waitUntil and updates status after completion', async () => {
    const primaryProvider = {
      upload: vi.fn(async () => ({ success: true, fileId: 'primary-1' })),
    };
    const s3Provider = {
      upload: vi.fn(async () => ({ success: true, fileId: 'mirror-s3' })),
    };
    const captured = [];
    const context = {
      waitUntil: vi.fn((promise) => captured.push(promise)),
    };

    mocks.routerInstance.getMirrors.mockReturnValue(['r2', 's3']);
    mocks.routerInstance.isAsyncMirror.mockReturnValue(true);
    mocks.getStorageProvider.mockImplementation((_env, providerName) => {
      if (providerName === 'r2') return primaryProvider;
      if (providerName === 's3') return s3Provider;
      return null;
    });

    const manager = new RedundancyManager({ DB: {} }, context);
    const updateSpy = vi.spyOn(manager, '_updateMirrorStatus').mockResolvedValue();

    await manager.upload({ name: 'demo.png' }, {});
    expect(context.waitUntil).toHaveBeenCalledTimes(1);

    await captured[0];
    expect(updateSpy).toHaveBeenCalledWith('primary-1', 's3', 'mirror-s3', 'synced');
  });

  it('warns when async mirrors run without context and catches failed background tasks', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mocks.getStorageProvider.mockReturnValue({
      upload: vi.fn(async () => {
        throw new Error('mirror failed');
      }),
    });

    const manager = new RedundancyManager({ DB: {} });
    const updateSpy = vi.spyOn(manager, '_updateMirrorStatus').mockResolvedValue();

    manager._mirrorAsync({ name: 'demo.png' }, {}, ['s3'], 'primary-1');
    await Promise.resolve();
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalledWith(
      'RedundancyManager: No context provided for async mirror, task may be cancelled.'
    );
    expect(errorSpy).toHaveBeenCalledWith('Async mirror to s3 failed:', expect.any(Error));
    expect(updateSpy).toHaveBeenCalledWith('primary-1', 's3', null, 'failed', 'mirror failed');
  });

  it('persists mirror status when DB is available and swallows database write errors', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const run = vi.fn(async () => ({ success: true }));
    const bind = vi.fn(() => ({ run }));
    const env = {
      DB: {
        prepare: vi.fn(() => ({ bind })),
      },
    };
    const manager = new RedundancyManager(env);

    await manager._updateMirrorStatus('file-1', 's3', 'mirror-1', 'synced', 'none');

    expect(bind).toHaveBeenCalledWith('file-1', 's3', 'mirror-1', 'synced', 'none', Date.now());

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    env.DB.prepare.mockReturnValueOnce({
      bind: vi.fn(() => ({
        run: vi.fn(async () => {
          throw new Error('db down');
        }),
      })),
    });

    await manager._updateMirrorStatus('file-1', 's3', 'mirror-1', 'synced');
    expect(errorSpy).toHaveBeenCalledWith('Failed to update mirror status:', expect.any(Error));

    const noDbManager = new RedundancyManager({});
    await expect(noDbManager._updateMirrorStatus('file-1', 's3', 'mirror-1', 'synced')).resolves.toBeUndefined();
  });

  it('reads mirror status rows and tolerates missing or failing DB bindings', async () => {
    const env = {
      DB: {
        prepare: vi.fn(() =>
          createDbStatement({
            results: [
              {
                provider: 's3',
                provider_file_id: 'mirror-1',
                status: 'synced',
                error: null,
                synced_at: 123,
              },
            ],
          })
        ),
      },
    };
    const manager = new RedundancyManager(env);

    await expect(manager.getMirrorStatus('file-1')).resolves.toEqual([
      {
        provider: 's3',
        id: 'mirror-1',
        status: 'synced',
        error: null,
        syncedAt: 123,
      },
    ]);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    env.DB.prepare.mockImplementationOnce(() => {
      throw new Error('query failed');
    });

    await expect(manager.getMirrorStatus('file-1')).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('Failed to get mirror status:', expect.any(Error));
    await expect(new RedundancyManager({}).getMirrorStatus('file-1')).resolves.toEqual([]);
  });

  it('uses metadata and D1 mirror ids when falling back across providers', async () => {
    const firstProvider = {
      getFile: vi.fn(async () => new Response('not-here', { status: 500 })),
    };
    const secondProvider = {
      getFile: vi.fn(async () => new Response('fallback-ok', { status: 200 })),
    };
    mocks.getFallbackChain.mockReturnValue(['r2', 's3']);
    mocks.getStorageProvider.mockImplementation((_env, providerName) => {
      if (providerName === 'r2') return firstProvider;
      if (providerName === 's3') return secondProvider;
      return null;
    });

    const env = {
      STORAGE_FALLBACK_ENABLED: 'true',
      STORAGE_FALLBACK_TIMEOUT: '50',
      DB: {
        prepare: vi.fn(() =>
          createDbStatement({
            results: [{ provider: 's3', provider_file_id: 'mirror-s3', status: 'synced' }],
          })
        ),
      },
    };

    const response = await getFileWithFallback(
      env,
      'primary-file',
      new Request('https://example.com/file'),
      {
        storage: {
          primary: 'r2',
          primaryId: 'primary-storage-id',
        },
      }
    );

    expect(firstProvider.getFile).toHaveBeenCalledWith('primary-storage-id', expect.any(Request));
    expect(secondProvider.getFile).toHaveBeenCalledWith('mirror-s3', expect.any(Request));
    expect(await response.text()).toBe('fallback-ok');
  });

  it('returns 404 after all fallback providers fail', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.getFallbackChain.mockReturnValue(['r2', 's3']);
    mocks.getStorageProvider.mockImplementation((_env, providerName) => ({
      getFile:
        providerName === 'r2'
          ? vi.fn(async () => {
              throw new Error('network down');
            })
          : vi.fn(async () => new Response('still missing', { status: 500 })),
    }));

    const response = await getFileWithFallback(
      {
        STORAGE_FALLBACK_ENABLED: 'true',
        STORAGE_FALLBACK_TIMEOUT: '50',
      },
      'file-404',
      new Request('https://example.com/file'),
      null
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('File not found in any storage');
    expect(warnSpy).toHaveBeenCalledWith('Fallback: r2 failed for file-404:', 'network down');
  });
});
