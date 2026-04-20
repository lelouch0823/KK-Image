import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StatsRepository } from '../StatsRepository.js';

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

describe('StatsRepository', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T10:00:00.000Z'));
  });

  it('aggregates global stats, status maps, and traffic payloads', async () => {
    const db = createSequentialDb([
      {
        first: {
          total_files: 12,
          total_size: 4096,
          type_count: 3,
          today_uploads: 2,
          folder_count: 4,
          album_count: 5,
          space_count: 6,
        },
      },
      {
        all: {
          results: [{ id: 'file-1', name: 'hero.jpg', type: 'image/jpeg', created_at: 100 }],
        },
      },
      {
        all: {
          results: [
            { status: 'normal', count: 8 },
            { status: 'blocked', count: 1 },
            { status: null, count: 99 },
          ],
        },
      },
      {
        all: {
          results: [{ type: 'image/jpeg', count: 10, size: 2048 }],
        },
      },
      {
        all: {
          results: [{ id: 'space-1', name: 'Showroom', views: 99, created_at: 200 }],
        },
      },
      {
        all: {
          results: [
            { date: '2026-04-17', count: 2 },
            { date: '2026-04-18', count: 3 },
          ],
        },
      },
      {
        first: {
          total_orders: 9,
          pending_orders: 4,
          fulfilled_orders: 3,
          active_salespersons: 2,
          multiline_orders: 1,
        },
      },
    ]);

    const repo = new StatsRepository(db);

    await expect(repo.getGlobalStats(123456)).resolves.toEqual({
      files: {
        total: 12,
        totalSize: 4096,
        typeCount: 3,
        todayUploads: 2,
      },
      folders: { total: 4 },
      albums: { total: 5 },
      spaces: { total: 6 },
      fileTypes: [{ type: 'image/jpeg', count: 10, size: 2048 }],
      status: {
        normal: 8,
        blocked: 1,
        whitelisted: 0,
        liked: 0,
      },
      traffic: {
        monthTotal: 5,
        daily: {
          '2026-04-17': 2,
          '2026-04-18': 3,
        },
        topSpaces: [{ id: 'space-1', name: 'Showroom', views: 99, created_at: 200 }],
      },
      recentFiles: [{ id: 'file-1', name: 'hero.jpg', type: 'image/jpeg', created_at: 100 }],
      business: {
        totalOrders: 9,
        pendingOrders: 4,
        fulfilledOrders: 3,
        activeSalespersons: 2,
        multilineOrders: 1,
      },
    });

    expect(db.prepare).toHaveBeenCalledTimes(7);
    expect(db.statements[0].params).toEqual([123456]);
    expect(db.statements[5].params).toEqual([Date.now() - 30 * 24 * 60 * 60 * 1000]);
  });

  it('falls back to zero-safe values when aggregate rows are missing', async () => {
    const db = createSequentialDb([
      { first: undefined },
      { all: { results: [] } },
      { all: undefined },
      { all: { results: [] } },
      { all: { results: [] } },
      { all: { results: [] } },
      { first: undefined },
    ]);

    const repo = new StatsRepository(db);

    await expect(repo.getGlobalStats(1)).resolves.toEqual({
      files: {
        total: 0,
        totalSize: 0,
        typeCount: 0,
        todayUploads: 0,
      },
      folders: { total: 0 },
      albums: { total: 0 },
      spaces: { total: 0 },
      fileTypes: [],
      status: {
        normal: 0,
        blocked: 0,
        whitelisted: 0,
        liked: 0,
      },
      traffic: {
        monthTotal: 0,
        daily: {},
        topSpaces: [],
      },
      recentFiles: [],
      business: {
        totalOrders: 0,
        pendingOrders: 0,
        fulfilledOrders: 0,
        activeSalespersons: 0,
        multilineOrders: 0,
      },
    });
  });

  it('returns upload trends and recent files with the requested limits', async () => {
    const db = createSequentialDb([
      {
        all: {
          results: [{ date: '2026-04-18', count: 4, size: 1024 }],
        },
      },
      {
        all: {
          results: [{ id: 'file-2', timestamp: 222 }],
        },
      },
      {
        all: {
          results: [{ id: 'file-3', timestamp: 333 }],
        },
      },
    ]);

    const repo = new StatsRepository(db);

    await expect(repo.getUploadTrends(999)).resolves.toEqual([
      { date: '2026-04-18', count: 4, size: 1024 },
    ]);
    await expect(repo.getRecentFiles()).resolves.toEqual([{ id: 'file-2', timestamp: 222 }]);
    await expect(repo.getRecentFiles(2)).resolves.toEqual([{ id: 'file-3', timestamp: 333 }]);

    expect(db.statements[0].params).toEqual([999]);
    expect(db.statements[1].params).toEqual([5]);
    expect(db.statements[2].params).toEqual([2]);
  });
});
