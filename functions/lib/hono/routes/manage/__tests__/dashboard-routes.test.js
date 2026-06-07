import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  requiredPermissions: [],
  projectionGet: vi.fn(),
  refresh: vi.fn(),
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
  const actual = await vi.importActual(
    '../../../../../services/SystemStatsProjectionRefreshService.js'
  );
  return {
    ...actual,
    SystemStatsProjectionRefreshService: vi.fn(() => ({
      refresh: mocks.refresh,
    })),
  };
});

import dashboardApp from '../dashboard.js';
import { STATS_PROJECTION_SCOPES } from '../../../../../services/SystemStatsProjectionRefreshService.js';

function createApp() {
  const app = new Hono();
  app.route('/api/manage/dashboard', dashboardApp);
  return app;
}

describe('manage dashboard routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiredPermissions.length = 0;
  });

  it('returns cached dashboard projection without refreshing', async () => {
    mocks.projectionGet.mockResolvedValueOnce({
      payload: {
        data: {
          todayCount: 3,
          recentFiles: [{ id: 'file-1' }],
        },
      },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/dashboard/overview',
      { method: 'GET' },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    expect(mocks.requiredPermissions).toContain('stats:read');
    expect(mocks.projectionGet).toHaveBeenCalledWith(STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({
      success: true,
      data: {
        todayCount: 3,
        recentFiles: [{ id: 'file-1' }],
      },
    });
  });
});
