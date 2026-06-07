import { describe, expect, it } from 'vitest';
import { buildListCacheUrls, createListCacheInvalidator } from '../route-helpers.js';

describe('list cache helpers', () => {
  it('builds normalized default-first-page urls', () => {
    expect(
      buildListCacheUrls('https://example.com', '/api/manage/customers', {
        allowedKeys: ['page', 'limit', 'search'],
        defaults: { page: 1, limit: 20 },
        maxLimit: 100,
        query: { search: 'abc' },
      })
    ).toEqual([
      'https://example.com/api/manage/customers',
      'https://example.com/api/manage/customers?limit=20&page=1',
      'https://example.com/api/manage/customers?limit=20&page=1&search=abc',
    ]);
  });

  it('dedupes and normalizes provided variants', () => {
    expect(
      buildListCacheUrls('https://example.com', '/api/manage/products', {
        allowedKeys: ['page', 'limit', 'search', 'brand'],
        defaults: { page: 1, limit: 20 },
        maxLimit: 100,
        queryVariants: [
          { brand: 'ACME', page: '0', limit: '999' },
          { limit: 20, brand: 'ACME', page: 1 },
          { search: '' },
        ],
      })
    ).toEqual([
      'https://example.com/api/manage/products',
      'https://example.com/api/manage/products?limit=20&page=1',
      'https://example.com/api/manage/products?brand=ACME&limit=100&page=1',
      'https://example.com/api/manage/products?brand=ACME&limit=20&page=1',
    ]);
  });

  it('creates invalidator bound to request origin', () => {
    const invalidate = createListCacheInvalidator('/api/manage/orders', {
      allowedKeys: ['page', 'limit', 'status'],
      defaults: { page: 1, limit: 20 },
      maxLimit: 100,
      queryVariants: [{ status: 'pending' }],
    });

    expect(
      invalidate({
        req: { url: 'https://example.com/api/manage/orders?page=2' },
      })
    ).toEqual([
      'https://example.com/api/manage/orders',
      'https://example.com/api/manage/orders?limit=20&page=1',
      'https://example.com/api/manage/orders?limit=20&page=1&status=pending',
    ]);
  });
});
