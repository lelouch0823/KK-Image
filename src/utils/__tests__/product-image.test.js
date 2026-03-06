import { describe, expect, it } from 'vitest';
import {
  resolveBoundProductMainImageSrc,
  resolvePrimaryProductImageSrc,
  resolveProductImageSrcList,
  resolveSelectedVariantMainImageSrc,
  resolveVariantPrimaryImageSrc,
} from '@/utils/product-image.js';

describe('product-image helpers', () => {
  it('resolves variant primary image src from variant image object list', () => {
    const src = resolveVariantPrimaryImageSrc({
      images: [{ image_id: 'img-variant-1', is_primary: 1 }],
    });
    expect(src).toBe('/file/img-variant-1');
  });

  it('resolves bound product main image src with variant-first strategy', () => {
    const src = resolveBoundProductMainImageSrc({
      images: ['img-product-1'],
      selectedVariant: {
        images: [{ image_id: 'img-variant-2', is_primary: 1 }],
      },
    });
    expect(src).toBe('/file/img-variant-2');
  });

  it('falls back to product image when bound product has no variant image', () => {
    const src = resolveBoundProductMainImageSrc({
      images: [{ image_id: 'img-product-2' }],
      selectedVariant: {},
    });
    expect(src).toBe('/file/img-product-2');
  });

  it('returns normalized src list for product images', () => {
    const srcList = resolveProductImageSrcList({
      images: JSON.stringify([
        'img-1',
        { image_id: 'img-2' },
        { url: 'https://example.com/a.jpg' },
      ]),
    });
    expect(srcList).toEqual(['/file/img-1', '/file/img-2', 'https://example.com/a.jpg']);
  });

  it('returns empty list for invalid image payload', () => {
    expect(resolveProductImageSrcList({ images: '[bad-json' })).toEqual([]);
    expect(resolveProductImageSrcList({ images: [null, {}] })).toEqual([]);
  });

  it('keeps compatibility for primary product image resolver', () => {
    const src = resolvePrimaryProductImageSrc({ images: [{ id: 'img-legacy' }] });
    expect(src).toBe('/file/img-legacy');
  });

  it('skips invalid first image and resolves next valid image', () => {
    const src = resolvePrimaryProductImageSrc({
      images: [{ foo: 'bar' }, { image_id: 'img-next-valid' }],
    });
    expect(src).toBe('/file/img-next-valid');
  });

  it('deduplicates normalized product image src list', () => {
    const srcList = resolveProductImageSrcList({
      images: [
        'img-dup',
        { image_id: 'img-dup' },
        { url: 'https://example.com/d.jpg' },
        'https://example.com/d.jpg',
      ],
    });
    expect(srcList).toEqual(['/file/img-dup', 'https://example.com/d.jpg']);
  });

  it('resolves selected variant image in strict mode without product fallback', () => {
    const src = resolveSelectedVariantMainImageSrc({
      images: ['img-product-level'],
      selectedVariant: {
        images: [{ image_id: 'img-variant-strict', is_primary: 1 }],
      },
    });
    expect(src).toBe('/file/img-variant-strict');
  });

  it('returns null in strict mode when selected variant has no image', () => {
    const src = resolveSelectedVariantMainImageSrc({
      images: ['img-product-level'],
      selectedVariant: {
        images: [],
        primaryImage: null,
        image_id: null,
      },
    });
    expect(src).toBeNull();
  });
});
