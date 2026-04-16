import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  requiredPermissions: [],
  projectionGet: vi.fn(),
  refresh: vi.fn(),
  getGlobalStats: vi.fn(),
  getUploadTrends: vi.fn(),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: (permission) => async (_c, next) => {
    mocks.requiredPermissions.push(permission);
    await next();
  },
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => {
    await next();
  },
}));

vi.mock('../../../../../repositories/SystemStatsProjectionRepository.js', () => ({
  SystemStatsProjectionRepository: vi.fn(() => ({
    get: mocks.projectionGet,
  })),
}));

vi.mock('../../../../../services/SystemStatsProjectionRefreshService.js', async () => {
  const actual = await vi.importActual('../../../../../services/SystemStatsProjectionRefreshService.js');
  return {
    ...actual,
    SystemStatsProjectionRefreshService: vi.fn(() => ({
      refresh: mocks.refresh,
    })),
  };
});

vi.mock('../../../../../repositories/StatsRepository.js', () => ({
  StatsRepository: vi.fn(() => ({
    getGlobalStats: mocks.getGlobalStats,
    getUploadTrends: mocks.getUploadTrends,
  })),
}));

import statsApp from '../stats.js';
import { STATS_PROJECTION_SCOPES } from '../../../../../services/SystemStatsProjectionRefreshService.js';

function createApp() {
  const app = new Hono();
  app.route('/api/manage/stats', statsApp);
  return app;
}

describe('manage stats routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiredPermissions.length = 0;
  });

  it('returns cached manage stats projection without refreshing', async () => {
    mocks.projectionGet.mockResolvedValueOnce({
      payload: {
        data: {
          storage: { totalFiles: 10 },
        },
      },
    });

    const app = createApp();
    const res = await app.request('http://localhost/api/manage/stats', { method: 'GET' }, { DB: {} });

    expect(res.status).toBe(200);
    expect(mocks.requiredPermissions).toContain('stats:read');
    expect(mocks.projectionGet).toHaveBeenCalledWith(STATS_PROJECTION_SCOPES.MANAGE_STATS);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.getGlobalStats).not.toHaveBeenCalled();
  });

  it('keeps uploads trend reads on the live stats repository instead of projection cache', async () => {
    mocks.getUploadTrends.mockResolvedValueOnce([{ date: '2026-04-10', count: 3, size: 4096 }]);

    const app = createApp();
    const res = await app.request('http://localhost/api/manage/stats/uploads?days=14', { method: 'GET' }, { DB: {} });

    expect(res.status).toBe(200);
    expect(mocks.projectionGet).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.getUploadTrends).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        period: 14,
        uploads: [{ date: '2026-04-10', count: 3, size: 4096 }],
      },
    });
  });
});
