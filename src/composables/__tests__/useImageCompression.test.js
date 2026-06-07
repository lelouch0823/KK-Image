import { beforeEach, describe, expect, it, vi } from 'vitest';

const { imageCompressionMock, loadSettingsMock, getSettingsParsedMock } = vi.hoisted(() => ({
  imageCompressionMock: vi.fn(
    async (_file, options = {}) => new Blob(['mock'], { type: options.fileType || 'image/webp' })
  ),
  loadSettingsMock: vi.fn(async () => {}),
  getSettingsParsedMock: vi.fn(() => ({ enabled: true })),
}));

vi.mock('browser-image-compression', () => ({
  default: imageCompressionMock,
}));

vi.mock('../useWatermarkSettings', () => ({
  useWatermarkSettings: () => ({
    loadSettings: loadSettingsMock,
    getSettingsParsed: getSettingsParsedMock,
  }),
}));

import { useImageCompression } from '../useImageCompression';

describe('useImageCompression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data URL output for AI consumption', async () => {
    const { compressImageToDataUrl } = useImageCompression({
      fileType: 'image/jpeg',
      applyWatermark: false,
    });
    const input = new File([new Uint8Array([1, 2, 3])], 'demo.png', { type: 'image/png' });

    const result = await compressImageToDataUrl(input);

    expect(result.file.type).toBe('image/jpeg');
    expect(result.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(result.file.name.endsWith('.jpg')).toBe(true);
  });

  it('skips watermark loading when applyWatermark is false', async () => {
    const { compressImage } = useImageCompression({
      fileType: 'image/jpeg',
      applyWatermark: false,
    });
    const input = new File([new Uint8Array([4, 5, 6])], 'no-wm.png', { type: 'image/png' });

    await compressImage(input);

    expect(loadSettingsMock).not.toHaveBeenCalled();
    expect(getSettingsParsedMock).not.toHaveBeenCalled();
  });
});
