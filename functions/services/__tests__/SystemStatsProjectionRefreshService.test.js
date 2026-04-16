import { describe, expect, it, vi } from 'vitest';

import {
  STATS_PROJECTION_SCOPES,
  SystemStatsProjectionRefreshService,
} from '../SystemStatsProjectionRefreshService.js';

describe('SystemStatsProjectionRefreshService', () => {
  it('materializes manage stats payload into the projection contract', async () => {
    const projectionRepo = {
      upsert: vi.fn(async (scope, payload, updatedAt) => ({ scope, payload, updatedAt })),
    };
    const statsRepo = {
      getGlobalStats: vi.fn(async () => ({
        files: {
          total: 10,
          totalSize: 1024,
          todayUploads: 2,
        },
        traffic: {
          monthTotal: 7,
          daily: {},
          topSpaces: [],
        },
        status: { normal: 9, blocked: 1 },
        fileTypes: [{ type: 'image/jpeg', count: 10 }],
      })),
    };
    const service = new SystemStatsProjectionRefreshService({}, {
      now: () => 1710000000000,
      statsRepo,
      projectionRepo,
    });

    const result = await service.refresh(STATS_PROJECTION_SCOPES.MANAGE_STATS);

    expect(projectionRepo.upsert).toHaveBeenCalledWith(
      STATS_PROJECTION_SCOPES.MANAGE_STATS,
      expect.objectContaining({
        data: expect.objectContaining({
          storage: expect.objectContaining({
            totalFiles: 10,
            totalSize: 1024,
            todayUploads: 2,
          }),
          health: expect.objectContaining({
            status: { normal: 9, blocked: 1 },
          }),
        }),
      }),
      1710000000000
    );
    expect(result.scope).toBe(STATS_PROJECTION_SCOPES.MANAGE_STATS);
  });

  it('materializes dashboard overview payload into the projection contract', async () => {
    const projectionRepo = {
      upsert: vi.fn(async (scope, payload, updatedAt) => ({ scope, payload, updatedAt })),
    };
    const orderStatsRepo = {
      countCreatedAfter: vi.fn(async (timestamp) => (timestamp > 1 ? 3 : 9)),
      countByStatus: vi.fn(async () => 5),
      getRecentPending: vi.fn(async () => [{ id: 'o-1' }]),
      countCreatedBetween: vi.fn(async () => 4),
      getTodayHourlyTrend: vi.fn(async () => [{ hour: '09', count: 1 }]),
      getLast7DaysPendingTrend: vi.fn(async () => [{ date: '2026-04-10', count: 2 }]),
      getLast7DaysOrderTrend: vi.fn(async () => [{ date: '2026-04-10', count: 3 }]),
      getLast7DaysShareTrend: vi.fn(async () => [{ date: '2026-04-10', count: 1 }]),
    };
    const statsRepo = {
      getRecentFiles: vi.fn(async () => [{
        id: 'file-1',
        storage_key: 'storage/file-1',
      }]),
    };
    const folderRepo = {
      findShared: vi.fn(async () => ({ items: [{ id: 'share-1' }] })),
    };
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ count: 6 })),
        })),
      })),
    };
    const service = new SystemStatsProjectionRefreshService(db, {
      now: () => 1710000000000,
      orderStatsRepo,
      statsRepo,
      folderRepo,
      projectionRepo,
    });

    const result = await service.refresh(STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW);

    expect(orderStatsRepo.countByStatus).toHaveBeenCalledWith('pending');
    expect(statsRepo.getRecentFiles).toHaveBeenCalledWith(5);
    expect(folderRepo.findShared).toHaveBeenCalledWith({ limit: 5 });
    expect(projectionRepo.upsert).toHaveBeenCalledWith(
      STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW,
      expect.objectContaining({
        data: expect.objectContaining({
          pendingCount: 5,
          activeSharesCount: 6,
          recentPendingOrders: [{ id: 'o-1' }],
          recentShares: [{ id: 'share-1' }],
        }),
      }),
      1710000000000
    );
    expect(result.scope).toBe(STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW);
  });
});
