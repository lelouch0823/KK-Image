import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBatchDownload } from '../useBatchDownload';

const addToast = vi.fn();
const zipFile = vi.fn();
const generateAsync = vi.fn(async () => new Blob(['zip']));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

vi.mock('jszip', () => ({
  default: class MockZip {
    file(...args) {
      return zipFile(...args);
    }

    async generateAsync(...args) {
      return generateAsync(...args);
    }
  },
}));

describe('useBatchDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:zip'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
    });
  });

  it('shows error instead of fake success when every file download fails', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      blob: async () => new Blob(['bad']),
    });

    const { downloadAll } = useBatchDownload();

    await downloadAll(
      [
        { url: '/file/a.jpg', name: 'a.jpg' },
        { url: '/file/b.jpg', name: 'b.jpg' },
      ],
      'space-export'
    );

    expect(zipFile).not.toHaveBeenCalled();
    expect(generateAsync).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith({
      message: 'batchDownload.failed',
      type: 'error',
    });
  });

  it('keeps successful downloads when only part of the batch fails', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['ok']),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        blob: async () => new Blob(['missing']),
      });

    const { downloadAll } = useBatchDownload();

    await downloadAll(
      [
        { url: '/file/a.jpg', name: 'a.jpg' },
        { url: '/file/b.jpg', name: 'b.jpg' },
      ],
      'space-export'
    );

    expect(zipFile).toHaveBeenCalledTimes(1);
    expect(zipFile).toHaveBeenCalledWith('a.jpg', expect.any(Blob));
    expect(generateAsync).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith({
      message: 'batchDownload.started',
      type: 'success',
    });
  });
});
