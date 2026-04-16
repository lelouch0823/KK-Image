import { Hono } from 'hono';
import { withCache } from '../../middleware/cache.js';
import { requirePermission } from '../../middleware/auth.js';
import { SystemStatsProjectionRepository } from '../../../../repositories/SystemStatsProjectionRepository.js';
import {
  STATS_PROJECTION_SCOPES,
  SystemStatsProjectionRefreshService,
} from '../../../../services/SystemStatsProjectionRefreshService.js';

const app = new Hono();
app.use('*', requirePermission('stats:read'));

async function loadDashboardProjection(db) {
  const projectionRepo = new SystemStatsProjectionRepository(db);
  const cachedProjection = await projectionRepo.get(STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW);
  if (cachedProjection?.payload) {
    return cachedProjection.payload;
  }

  const refreshService = new SystemStatsProjectionRefreshService(db, {
    projectionRepo,
  });
  const refreshedProjection = await refreshService.refresh(STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW);
  return refreshedProjection?.payload || { data: null };
}

/**
 * GET /overview - 获取仪表盘概览数据 (SOTA: 聚合接口)
 */
app.get('/overview', withCache(20), async (c) => {
    const projection = await loadDashboardProjection(c.env.DB);
    return c.json({
        success: true,
        ...(projection || {}),
    });
});

export default app;
