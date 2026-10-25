import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useUploadQueue } from '../useUploadQueue';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  requestAuth: vi.fn(),
  compressImage: vi.fn(),
  xhrInstances: [],
}));

vi.mock('@/utils/common', () => ({
  generateRandomId: (prefix) => `${prefix}-fixed-id`,
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, args) => {
      if (key === 'uploadQueue.fileTooLarge') return `too large ${args.count}`;
      return key;
    },
  }),
}));

vi.mock('@/composables/useRequestAdapters', () => ({
  useRequestAdapters: () => ({ requestAuth: mocks.requestAuth }),
}));

vi.mock('@/composables/useImageCompression', () => ({
  useImageCompression: () => ({
    compressImage: mocks.compressImage,
  }),
}));

class MockXMLHttpRequest {
  constructor() {
    this.upload = { onprogress: null };
    this.withCredentials = false;
    this.status = 0;
    this.responseText = '';
    this.method = null;
    this.url = null;
    this.async = true;
    this.sentBody = null;
    this.aborted = false;
    this.onload = null;
    this.onerror = null;
    mocks.xhrInstances.push(this);
  }

  open(method, url, async = true) {
    this.method = method;
    this.url = url;
    this.async = async;
  }

  send(body) {
    this.sentBody = body;
  }

  abort() {
    this.aborted = true;
  }
}

describe('useUploadQueue public behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.xhrInstances.length = 0;
    mocks.compressImage.mockImplementation(async (file, onProgress) => {
      onProgress?.(35);
      return {
        file,
        hash: 'compressed-hash',
        originalHash: 'original-hash',
      };
    });
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(async () => new Uint8Array([1, 2, 3, 4]).buffer),
      },
    });
    const queueApi = useUploadQueue();
    queueApi.clearAll();
    queueApi.isMinimized.value = false;
  });

  it('derives queue summary state from mixed upload items', () => {
    const queueApi = useUploadQueue();
    queueApi.queue.value = [
      { id: '1', status: 'uploading', progress: 50, size: 1000, speed: 200 },
      { id: '2', status: 'pending', progress: 0, size: 2000, speed: 0 },
      { id: '3', status: 'success', progress: 100, size: 500, speed: 0 },
      { id: '4', status: 'error', progress: 25, size: 1000, speed: 0 },
    ];

    expect(queueApi.hasItems.value).toBe(true);
    expect(queueApi.overallProgress.value).toBe(43);
    expect(queueApi.activeCount.value).toBe(1);
    expect(queueApi.pendingCount.value).toBe(1);
    expect(queueApi.completedCount.value).toBe(1);
    expect(queueApi.totalSpeed.value).toBe(200);
    expect(queueApi.estimatedTimeRemaining.value).toBe(13);
  });

  it('warns when adding files without folder or space target', () => {
    const queueApi = useUploadQueue();
    const file = new File(['demo'], 'demo.jpg', { type: 'image/jpeg' });

    queueApi.addFiles([file], '');

    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'uploadQueue.selectFolderFirst',
      type: 'warning',
    });
    expect(queueApi.queue.value).toEqual([]);
  });

  it('rejects oversized files before queueing them', () => {
    const queueApi = useUploadQueue();
    const hugeFile = {
      name: 'huge.zip',
      size: 100 * 1024 * 1024 + 1,
      type: 'application/zip',
    };

    queueApi.addFiles([hugeFile], 'root');

    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'too large 1: huge.zip ',
      type: 'error',
      duration: 5000,
    });
    expect(queueApi.queue.value).toEqual([]);
  });

  it('removes active items, clears completed items, and aborts full reset', () => {
    const queueApi = useUploadQueue();
    const abortUploading = vi.fn();
    const abortSecond = vi.fn();

    queueApi.queue.value = [
      { id: '1', status: 'uploading', progress: 20, xhr: { abort: abortUploading } },
      { id: '2', status: 'success', progress: 100, xhr: null },
      { id: '3', status: 'uploading', progress: 40, xhr: { abort: abortSecond } },
    ];
    queueApi.isUploading.value = true;

    queueApi.removeFile('1');
    expect(abortUploading).toHaveBeenCalled();
    expect(queueApi.queue.value.map((item) => item.id)).toEqual(['2', '3']);

    queueApi.clearCompleted();
    expect(queueApi.queue.value.map((item) => item.id)).toEqual(['3']);

    queueApi.clearAll();
    expect(abortSecond).toHaveBeenCalled();
    expect(queueApi.queue.value).toEqual([]);
    expect(queueApi.isUploading.value).toBe(false);
  });

  it('registers and unregisters folder refresh callbacks without throwing', () => {
    const queueApi = useUploadQueue();
    const refresh = vi.fn();

    expect(() => queueApi.registerFolderRefresh('folder-1', refresh)).not.toThrow();
    expect(() => queueApi.unregisterFolderRefresh('folder-1')).not.toThrow();
    expect(() => queueApi.unregisterFolderRefresh('')).not.toThrow();
  });

  it('deduplicates compressed images via hash precheck and refreshes the folder callback', async () => {
    const queueApi = useUploadQueue();
    const refresh = vi.fn();
    const image = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });

    queueApi.registerFolderRefresh('folder-1', refresh);
    queueApi.isMinimized.value = true;
    // R2（审查 F-2）：预检命中后必须再调用服务端 instant-upload 认领建行
    mocks.requestAuth
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              exists: true,
              file: { id: 'existing-file' },
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              exists: true,
              file: { id: 'instant-file-1', name: 'photo.jpg' },
            },
          }),
      });

    queueApi.addFiles([image], 'folder-1');
    await flushPromises();

    expect(queueApi.isMinimized.value).toBe(false);
    expect(mocks.compressImage).toHaveBeenCalledTimes(1);
    expect(mocks.requestAuth).toHaveBeenCalledWith('/api/manage/files/check-hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_hash: 'original-hash' }),
    });
    // R2：秒传命中必须发生服务端建行调用（instant-upload），而不是本地跳过
    expect(mocks.requestAuth).toHaveBeenCalledWith('/api/manage/files/instant-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_hash: 'original-hash',
        folderId: 'folder-1',
        name: 'photo.jpg',
      }),
    });
    expect(queueApi.queue.value[0]).toEqual(
      expect.objectContaining({
        status: 'success',
        progress: 100,
        hash: 'compressed-hash',
        originalHash: 'original-hash',
      })
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'photo.jpg uploadQueue.instantUpload',
      type: 'success',
      duration: 2000,
    });
    // 服务端已建行，不应再有 XHR 上传
    expect(mocks.xhrInstances).toHaveLength(0);
  });

  it('falls back to a full upload when the server refuses the instant-upload claim', async () => {
    const queueApi = useUploadQueue();
    const refresh = vi.fn();
    const image = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });

    queueApi.registerFolderRefresh('folder-3', refresh);
    // 预检命中，但服务端认领失败（同源内容被并发清理/无 blob）→ 必须回退完整上传
    mocks.requestAuth
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              exists: true,
              file: { id: 'existing-file' },
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { exists: false },
          }),
      });

    queueApi.addFiles([image], 'folder-3');
    await flushPromises();

    expect(mocks.requestAuth).toHaveBeenCalledTimes(2);
    const fallbackXhr = mocks.xhrInstances[0];
    expect(fallbackXhr).toBeDefined();
    expect(fallbackXhr.method).toBe('POST');
    expect(fallbackXhr.url).toContain('/api/manage/folders/folder-3/upload');

    fallbackXhr.status = 200;
    fallbackXhr.responseText = JSON.stringify({ success: true });
    fallbackXhr.onload?.();
    await flushPromises();

    expect(queueApi.queue.value[0]).toEqual(
      expect.objectContaining({
        status: 'success',
        progress: 100,
      })
    );
  });

  it('uploads images through xhr with space options and reports parse failures for bad responses', async () => {
    const queueApi = useUploadQueue();
    const refresh = vi.fn();
    const image = new File(['image'], 'poster.png', { type: 'image/png' });

    queueApi.registerFolderRefresh('folder-2', refresh);
    // R2：spaceId 上传跳过 check-hash/instant-upload 预检（空间关联由
    // manage/upload 服务端处理），不消费 requestAuth mock

    queueApi.addFiles([image], 'folder-2', { spaceId: 'space-1' });
    await flushPromises();

    const successXhr = mocks.xhrInstances[0];
    expect(successXhr.method).toBe('POST');
    expect(successXhr.url).toContain('/api/manage/upload');
    expect(successXhr.url).toContain('contentHash=compressed-hash');
    expect(successXhr.url).toContain('originalHash=original-hash');
    expect(successXhr.url).toContain('spaceId=space-1');

    successXhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 50,
      total: 100,
    });
    successXhr.status = 200;
    successXhr.responseText = JSON.stringify({ success: true });
    successXhr.onload?.();
    await flushPromises();

    expect(queueApi.queue.value[0]).toEqual(
      expect.objectContaining({
        status: 'success',
        progress: 100,
      })
    );
    expect(refresh).toHaveBeenCalledTimes(1);

    queueApi.clearAll();
    mocks.requestAuth.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            exists: false,
          },
        }),
    });

    queueApi.addFiles([image], 'folder-2');
    await flushPromises();

    const failedXhr = mocks.xhrInstances[1];
    failedXhr.status = 200;
    failedXhr.responseText = '{invalid-json';
    failedXhr.onload?.();
    await flushPromises();

    expect(queueApi.queue.value[0]).toEqual(
      expect.objectContaining({
        status: 'error',
        error: 'uploadQueue.parseError',
      })
    );

    mocks.requestAuth.mockImplementation(async (url) => {
      // R2：秒传命中后走两次请求——check-hash 预检 + instant-upload 认领建行。
      // 按端点分发响应，避免并发上传下 mock 顺序耦合
      if (String(url).includes('instant-upload')) {
        return {
          json: () =>
            Promise.resolve({
              success: true,
              data: { exists: true, file: { id: 'existing-file-2' } },
            }),
        };
      }
      return {
        json: () =>
          Promise.resolve({
            success: true,
            data: { exists: true, file: { id: 'existing-file-2' } },
          }),
      };
    });

    queueApi.retryFile(queueApi.queue.value[0].id);
    await flushPromises();

    expect(queueApi.queue.value[0]).toEqual(
      expect.objectContaining({
        status: 'success',
        progress: 100,
        error: null,
      })
    );
  });

  it('retries all failed uploads and reprocesses them immediately', async () => {
    const queueApi = useUploadQueue();
    const imageOne = new File(['one'], 'one.jpg', { type: 'image/jpeg' });
    const imageTwo = new File(['two'], 'two.jpg', { type: 'image/jpeg' });
    queueApi.queue.value = [
      {
        id: '1',
        file: imageOne,
        name: imageOne.name,
        size: imageOne.size,
        folderId: 'root',
        progress: 22,
        status: 'error',
        error: 'bad',
        speed: 50,
        hash: 'hash-1',
        options: {},
      },
      {
        id: '2',
        file: imageTwo,
        name: imageTwo.name,
        size: imageTwo.size,
        folderId: 'root',
        progress: 91,
        status: 'error',
        error: 'worse',
        speed: 99,
        hash: 'hash-2',
        options: {},
      },
      { id: '3', status: 'success', progress: 100, error: null, speed: 0, hash: 'hash-3' },
    ];

    mocks.requestAuth.mockImplementation(async (url) => {
      // R2：每个文件先 check-hash 预检、命中后 instant-upload 认领建行。
      // 按端点分发响应，避免两个并发上传的 mock 顺序耦合
      const payload =
        String(url).includes('instant-upload')
          ? { exists: true, file: { id: `existing-${Math.random().toString(36).slice(2, 8)}` } }
          : { exists: true, file: { id: 'prefetched' } };
      return { json: () => Promise.resolve({ success: true, data: payload }) };
    });

    queueApi.retryAllFailed();
    await flushPromises();

    expect(queueApi.queue.value[0]).toEqual(
      expect.objectContaining({
        id: '1',
        status: 'success',
        progress: 100,
        error: null,
        speed: 0,
      })
    );
    expect(queueApi.queue.value[1]).toEqual(
      expect.objectContaining({
        id: '2',
        status: 'success',
        progress: 100,
        error: null,
        speed: 0,
      })
    );
    expect(queueApi.queue.value[2]).toEqual(
      expect.objectContaining({
        id: '3',
        status: 'success',
        progress: 100,
        hash: 'hash-3',
      })
    );
  });
});
