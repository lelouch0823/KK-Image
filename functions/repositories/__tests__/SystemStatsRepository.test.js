import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemStatsRepository } from '../SystemStatsRepository.js';

function createSequentialDb(responses) {
  const queue = [...responses];
  const statements = [];

  return {
    prepare: vi.fn((sql) => {
      const response = queue.shift();
      if (!response) {
        throw new Error(`Unexpected prepare call for SQL: ${sql}`);
      }

      const statement = {
        sql,
        params: [],
        bind: vi.fn((...params) => {
          statement.params = params;
          return statement;
        }),
        first: vi.fn(async () => response.first),
        all: vi.fn(async () => response.all),
      };

      statements.push(statement);
      return statement;
    }),
    statements,
  };
}

describe('SystemStatsRepository', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T10:00:00.000Z'));
  });

  it('collects customer and space statistics with fixed time windows', async () => {
    const db = createSequentialDb([
      { first: { count: 20 } },
      { first: { count: 3 } },
      { first: { count: 7 } },
      { first: { totalViews: 99, totalDownloads: 12 } },
      { first: { count: 42 } },
    ]);

    const repo = new SystemStatsRepository(db);

    await expect(repo.getCustomerStats()).resolves.toEqual({
      total: 20,
      recentWeek: 3,
    });
    await expect(repo.getSpaceStats()).resolves.toEqual({
      total: 7,
      totalViews: 99,
      totalDownloads: 12,
      totalFiles: 42,
    });

    expect(db.statements[1].params).toEqual([Date.now() - 7 * 24 * 60 * 60 * 1000]);
  });

  it('returns salesperson and file aggregates with zero-safe fallbacks', async () => {
    const db = createSequentialDb([
      { first: { count: 8 } },
      { first: { count: 5 } },
      { all: { results: [{ name: 'Alice', store: 'S1', orderCount: 12 }] } },
      { first: { count: 12 } },
      { first: { totalSize: 1572864 } },
      {
        all: {
          results: [
            { type: 'image', count: 4 },
            { type: 'pdf', count: 2 },
          ],
        },
      },
      { first: { count: 6 } },
    ]);

    const repo = new SystemStatsRepository(db);

    await expect(repo.getSalespersonStats()).resolves.toEqual({
      total: 8,
      active: 5,
      topPerformers: [{ name: 'Alice', store: 'S1', orderCount: 12 }],
    });
    await expect(repo.getFileStats()).resolves.toEqual({
      total: 12,
      totalSizeBytes: 1572864,
      totalSizeMB: 1.5,
      typeDistribution: {
        image: 4,
        pdf: 2,
      },
    });
    await expect(repo.getFolderStats()).resolves.toEqual({ total: 6 });
  });

  it('falls back to empty aggregates when optional rows are absent', async () => {
    const db = createSequentialDb([
      { first: undefined },
      { first: undefined },
      { all: undefined },
    ]);

    const repo = new SystemStatsRepository(db);

    await expect(repo.getFileStats()).resolves.toEqual({
      total: 0,
      totalSizeBytes: 0,
      totalSizeMB: 0,
      typeDistribution: {},
    });
  });
});
