import { describe, expect, it } from 'vitest';
import { resolvePrimaryProductImageSrc } from '../image-resolver.js';

describe('resolvePrimaryProductImageSrc', () => {
  it('returns file url when first image is a string id', () => {
    expect(resolvePrimaryProductImageSrc({ images: ['img-1'] })).toBe('/file/img-1');
  });

  it('returns file url when first image is an object with image_id', () => {
    expect(resolvePrimaryProductImageSrc({ images: [{ image_id: 'img-2' }] })).toBe('/file/img-2');
  });

  it('returns file url when first image is an object with id', () => {
    expect(resolvePrimaryProductImageSrc({ images: [{ id: 'img-3' }] })).toBe('/file/img-3');
  });

  it('returns direct url when first image is an object with url', () => {
    expect(resolvePrimaryProductImageSrc({ images: [{ url: 'https://example.com/p.jpg' }] })).toBe(
      'https://example.com/p.jpg'
    );
  });

  it('returns direct url when image is already a full url string', () => {
    expect(resolvePrimaryProductImageSrc({ images: ['https://example.com/p2.jpg'] })).toBe(
      'https://example.com/p2.jpg'
    );
  });

  it('returns null when image payload is invalid', () => {
    expect(resolvePrimaryProductImageSrc({ images: [{}] })).toBeNull();
    expect(resolvePrimaryProductImageSrc({ images: [null] })).toBeNull();
    expect(resolvePrimaryProductImageSrc({ images: [] })).toBeNull();
    expect(resolvePrimaryProductImageSrc({ images: '[bad-json' })).toBeNull();
  });
});
