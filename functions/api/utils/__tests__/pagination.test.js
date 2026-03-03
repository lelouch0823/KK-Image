import { describe, it, expect } from 'vitest';
import { toPositiveInt, parseRepoPagination } from '../pagination.js';

describe('pagination utils', () => {
  it('coerces invalid values with fallback', () => {
    expect(toPositiveInt('x', 5)).toBe(5);
  });

  it('clamps invalid page/limit and returns offset', () => {
    expect(parseRepoPagination({ page: 'x', limit: '999' }, { defaultLimit: 20, maxLimit: 100 }))
      .toEqual({ page: 1, limit: 100, offset: 0 });
  });

  it('uses defaults when missing', () => {
    expect(parseRepoPagination({}, { defaultPage: 2, defaultLimit: 30, maxLimit: 100 }))
      .toEqual({ page: 2, limit: 30, offset: 30 });
  });

  it('clamps non-positive numeric values to minimum bounds', () => {
    expect(parseRepoPagination({ page: -3, limit: 0 }, { defaultLimit: 20, maxLimit: 100 }))
      .toEqual({ page: 1, limit: 1, offset: 0 });
  });
});
