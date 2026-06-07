import { describe, it, expect } from 'vitest';
import { toPositiveInt, parseRepoPagination, normalizeListQuery } from '../pagination.js';

describe('pagination utils', () => {
  it('coerces invalid values with fallback', () => {
    expect(toPositiveInt('x', 5)).toBe(5);
  });

  it('clamps invalid page/limit and returns offset', () => {
    expect(
      parseRepoPagination({ page: 'x', limit: '999' }, { defaultLimit: 20, maxLimit: 100 })
    ).toEqual({ page: 1, limit: 100, offset: 0 });
  });

  it('uses defaults when missing', () => {
    expect(parseRepoPagination({}, { defaultPage: 2, defaultLimit: 30, maxLimit: 100 })).toEqual({
      page: 2,
      limit: 30,
      offset: 30,
    });
  });

  it('clamps non-positive numeric values to minimum bounds', () => {
    expect(
      parseRepoPagination({ page: -3, limit: 0 }, { defaultLimit: 20, maxLimit: 100 })
    ).toEqual({ page: 1, limit: 1, offset: 0 });
  });

  it('normalizes list query for cache-safe string output', () => {
    expect(
      normalizeListQuery(
        { page: '0', limit: '999', search: '', status: 'active', misc: 'skip-me' },
        {
          allowedKeys: ['page', 'limit', 'search', 'status'],
          defaults: { page: 1, limit: 20 },
          maxLimit: 100,
        }
      )
    ).toEqual({
      limit: '100',
      page: '1',
      status: 'active',
    });
  });

  it('keeps allowed non-empty values and injects default pagination', () => {
    expect(
      normalizeListQuery(
        { search: 'abc', category: 'bags', page: undefined, limit: null },
        {
          allowedKeys: ['page', 'limit', 'search', 'category'],
          defaults: { page: 1, limit: 20 },
          maxLimit: 100,
        }
      )
    ).toEqual({
      category: 'bags',
      limit: '20',
      page: '1',
      search: 'abc',
    });
  });
});
