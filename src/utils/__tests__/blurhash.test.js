import { afterEach, describe, expect, it, vi } from 'vitest';
import { blurhashToDataURL, decode, isBlurhashValid } from '../blurhash.js';

const SAMPLE_BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';

describe('blurhash utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('decodes a valid blurhash into RGBA pixels', () => {
    const pixels = decode(SAMPLE_BLURHASH, 4, 3);

    expect(pixels).toBeInstanceOf(Uint8ClampedArray);
    expect(pixels).toHaveLength(4 * 3 * 4);

    for (let index = 3; index < pixels.length; index += 4) {
      expect(pixels[index]).toBe(255);
    }
  });

  it('supports punch scaling and rejects invalid blurhash strings', () => {
    const pixels = decode(SAMPLE_BLURHASH, 2, 2, 1.5);

    expect(pixels).toHaveLength(16);
    expect(() => decode('bad', 2, 2)).toThrow('Invalid blurhash');
  });

  it('returns an empty string when document is unavailable', () => {
    vi.stubGlobal('document', undefined);

    expect(blurhashToDataURL(SAMPLE_BLURHASH)).toBe('');
  });

  it('renders decoded pixels to canvas and returns a data url', () => {
    const set = vi.fn();
    const putImageData = vi.fn();
    const createImageData = vi.fn(() => ({ data: { set } }));
    const getContext = vi.fn(() => ({ createImageData, putImageData }));
    const toDataURL = vi.fn(() => 'data:image/png;base64,blurhash');
    const canvas = { width: 0, height: 0, getContext, toDataURL };
    const createElement = vi.fn(() => canvas);

    vi.stubGlobal('document', { createElement });

    const result = blurhashToDataURL(SAMPLE_BLURHASH, 8, 6);

    expect(result).toBe('data:image/png;base64,blurhash');
    expect(createElement).toHaveBeenCalledWith('canvas');
    expect(createImageData).toHaveBeenCalledWith(8, 6);
    expect(set).toHaveBeenCalledOnce();
    expect(putImageData).toHaveBeenCalledOnce();
  });

  it('returns an empty string when canvas rendering fails', () => {
    const canvas = { getContext: vi.fn(() => null) };
    const createElement = vi.fn(() => canvas);

    vi.stubGlobal('document', { createElement });

    expect(blurhashToDataURL(SAMPLE_BLURHASH, 4, 4)).toBe('');
  });

  it('validates blurhash string length and type', () => {
    expect(isBlurhashValid(SAMPLE_BLURHASH)).toBe(true);
    expect(isBlurhashValid('short')).toBe(false);
    expect(isBlurhashValid('L00000')).toBe(false);
    expect(isBlurhashValid(null)).toBe(false);
  });
});
