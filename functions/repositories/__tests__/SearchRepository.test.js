import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFtsCache } from '../../api/utils/fts.js';
import { SearchRepository } from '../SearchRepository.js';

describe('SearchRepository', () => {
  beforeEach(() => {
    clearFtsCache();
  });

  it('excludes archived orders from FTS order search', async () => {
    const ftsCheckStmt = {
      bind: vi.fn(() => ftsCheckStmt),
      first: vi.fn(async () => ({ name: 'orders_fts' })),
    };
    const searchStmt = {
      bind: vi.fn(() => searchStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(ftsCheckStmt).mockReturnValueOnce(searchStmt),
    };

    await new SearchRepository(db).searchOrders('SO-1');

    expect(db.prepare.mock.calls[1][0]).toContain('o.archived_at IS NULL');
  });

  it('excludes archived orders from fallback LIKE order search', async () => {
    const ftsCheckStmt = {
      bind: vi.fn(() => ftsCheckStmt),
      first: vi.fn(async () => null),
    };
    const searchStmt = {
      bind: vi.fn(() => searchStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(ftsCheckStmt).mockReturnValueOnce(searchStmt),
    };

    await new SearchRepository(db).searchOrders('SO-1');

    expect(db.prepare.mock.calls[1][0]).toContain('o.archived_at IS NULL');
  });
});
