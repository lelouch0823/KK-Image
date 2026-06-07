import { describe, expect, it } from 'vitest';
import { getProductCacheUrls } from '../../../../middleware/cache.js';

describe('product cache URL builder', () => {
  it('includes product list and variant picker cache keys', () => {
    const urls = getProductCacheUrls({
      req: { url: 'https://example.com/api/manage/products' },
    });

    expect(urls).toContain('https://example.com/api/manage/products');
    expect(urls).toContain('https://example.com/api/manage/products?page=1&limit=20');
    expect(urls).toContain('https://example.com/api/manage/products/variants');
    expect(urls).toContain('https://example.com/api/manage/products/variants?page=1&limit=50');
    expect(urls).toContain(
      'https://example.com/api/manage/products/variants?search=&page=1&limit=50'
    );
  });
});
