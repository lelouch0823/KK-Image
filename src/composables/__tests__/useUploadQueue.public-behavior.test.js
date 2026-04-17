import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadQueue } from '../useUploadQueue';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  requestAuth: vi.fn(),
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
    compressImage: vi.fn(),
  }),
}));

describe('useUploadQueue public behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
