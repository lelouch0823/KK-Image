import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  imageCompression: vi.fn(),
  loadSettings: vi.fn(async () => {}),
  getSettingsParsed: vi.fn(() => ({ enabled: false })),
}));

vi.mock('browser-image-compression', () => ({
  default: mocks.imageCompression,
}));

vi.mock('../useWatermarkSettings', () => ({
  useWatermarkSettings: () => ({
    loadSettings: mocks.loadSettings,
    getSettingsParsed: mocks.getSettingsParsed,
  }),
}));

import { useImageCompression } from '../useImageCompression';

function createCanvas() {
  const ctx = {
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    fillText: vi.fn(),
    set font(_value) {},
    set fillStyle(_value) {},
    set globalAlpha(_value) {},
    set textBaseline(_value) {},
    set textAlign(_value) {},
    set shadowColor(_value) {},
    set shadowBlur(_value) {},
    set shadowOffsetX(_value) {},
    set shadowOffsetY(_value) {},
  };

  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((callback, type) => callback(new Blob(['wm'], { type: type || 'image/png' }))),
  };
}

describe('useImageCompression more coverage', () => {
  let originalCreateElement;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let originalImage;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCreateElement = document.createElement.bind(document);
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalImage = globalThis.Image;

    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    document.createElement = vi.fn((tagName) =>
      tagName === 'canvas' ? createCanvas() : originalCreateElement(tagName)
    );
  });

  afterEach(() => {
    document.createElement = originalCreateElement;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    globalThis.Image = originalImage;
    vi.unstubAllGlobals();
  });

  it('rejects non-image files and skips GIF compression', async () => {
    const { compressImage } = useImageCompression({ applyWatermark: false });

    await expect(
      compressImage(new File(['txt'], 'demo.txt', { type: 'text/plain' }))
    ).rejects.toThrow('Invalid image file');

    const gif = new File(['gif'], 'demo.gif', { type: 'image/gif' });
    const result = await compressImage(gif);
    expect(result.skipped).toBe(true);
    expect(result.file).toBe(gif);
    expect(result.ratio).toBe(1);
  });

  it('falls back to main-thread compression when worker compression fails', async () => {
    mocks.imageCompression
      .mockRejectedValueOnce(new Error('worker failed'))
      .mockResolvedValueOnce(new Blob(['ok'], { type: 'image/jpeg' }));

    const { compressImage } = useImageCompression({
      applyWatermark: false,
      fileType: 'image/jpeg',
    });

    const result = await compressImage(new File(['img'], 'demo.png', { type: 'image/png' }));

    expect(result.file.name).toBe('demo.jpg');
    expect(mocks.imageCompression).toHaveBeenCalledTimes(2);
    expect(mocks.imageCompression.mock.calls[1][1]).toEqual(
      expect.objectContaining({ useWebWorker: false })
    );
  });

  it('surfaces fallback compression failures after both attempts fail', async () => {
    mocks.imageCompression
      .mockRejectedValueOnce(new Error('worker failed'))
      .mockRejectedValueOnce(new Error('fallback failed'));

    const { compressImage } = useImageCompression({ applyWatermark: false });

    await expect(
      compressImage(new File(['img'], 'demo.png', { type: 'image/png' }))
    ).rejects.toThrow('fallback failed');
  });

  it('compresses batches and records per-item failures', async () => {
    mocks.imageCompression
      .mockResolvedValueOnce(new Blob(['ok'], { type: 'image/webp' }))
      .mockRejectedValueOnce(new Error('nope'))
      .mockRejectedValueOnce(new Error('still nope'));

    const { compressImages } = useImageCompression({ applyWatermark: false });

    const results = await compressImages([
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]);

    expect(results[0]).toEqual(expect.objectContaining({ success: true }));
    expect(results[1]).toEqual(
      expect.objectContaining({
        success: false,
        error: 'still nope',
      })
    );
  });

  it('uses fallback hashes when Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined);
    const { getFileHash } = useImageCompression({ applyWatermark: false });

    const hash = await getFileHash(
      new File(['abc'], 'hash.png', {
        type: 'image/png',
        lastModified: 123,
      })
    );

    expect(hash).toMatch(/^fallback-3-/);
  });

  it('loads image dimensions and rejects when image loading fails', async () => {
    class SuccessImage {
      constructor() {
        this.width = 640;
        this.height = 480;
      }

      set src(_value) {
        queueMicrotask(() => this.onload?.());
      }
    }

    globalThis.Image = SuccessImage;
    const { getImageDimensions } = useImageCompression({ applyWatermark: false });

    await expect(
      getImageDimensions(new File(['img'], 'demo.png', { type: 'image/png' }))
    ).resolves.toEqual({ width: 640, height: 480 });

    class FailImage {
      set src(_value) {
        queueMicrotask(() => this.onerror?.());
      }
    }

    globalThis.Image = FailImage;
    await expect(
      getImageDimensions(new File(['img'], 'demo.png', { type: 'image/png' }))
    ).rejects.toThrow('Failed to load image');
  });

  it('applies watermark settings before compression when watermarking is enabled', async () => {
    mocks.getSettingsParsed.mockReturnValueOnce({
      enabled: true,
      text: 'KK',
      position: 'bottom-right',
      opacity: 0.5,
      color: '#fff',
      sizeRatio: 0.1,
    });
    mocks.imageCompression.mockResolvedValueOnce(new Blob(['ok'], { type: 'image/webp' }));

    class WatermarkImage {
      constructor() {
        this.width = 320;
        this.height = 200;
      }

      set src(_value) {
        queueMicrotask(() => this.onload?.());
      }
    }

    globalThis.Image = WatermarkImage;
    const { compressImage } = useImageCompression({ applyWatermark: true });
    const result = await compressImage(new File(['img'], 'demo.png', { type: 'image/png' }));

    expect(mocks.loadSettings).toHaveBeenCalled();
    expect(mocks.imageCompression.mock.calls[0][0].name).toBe('wm_demo.png');
    expect(result.file.name).toBe('demo.webp');
  });

  it('skips watermark drawing when the image fails to load for watermarking', async () => {
    mocks.getSettingsParsed.mockReturnValueOnce({
      enabled: true,
      text: 'KK',
      position: 'center',
      opacity: 0.5,
      color: '#fff',
      sizeRatio: 0.1,
    });
    mocks.imageCompression.mockResolvedValueOnce(new Blob(['ok'], { type: 'image/webp' }));

    class FailWatermarkImage {
      set src(_value) {
        queueMicrotask(() => this.onerror?.());
      }
    }

    globalThis.Image = FailWatermarkImage;
    const input = new File(['img'], 'demo.png', { type: 'image/png' });
    const { compressImage } = useImageCompression({ applyWatermark: true });

    await compressImage(input);
    expect(mocks.imageCompression.mock.calls[0][0]).toBe(input);
  });
});
