import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { getChinaDayStart } from '../../../../_shared/utils.js';
import { StatsRepository } from '../../../../repositories/StatsRepository.js';
import { SystemStatsProjectionRepository } from '../../../../repositories/SystemStatsProjectionRepository.js';
import {
  STATS_PROJECTION_SCOPES,
  SystemStatsProjectionRefreshService,
} from '../../../../services/SystemStatsProjectionRefreshService.js';

const app = new Hono();

async function loadStatsProjection(db) {
  const projectionRepo = new SystemStatsProjectionRepository(db);
  const cachedProjection = await projectionRepo.get(STATS_PROJECTION_SCOPES.MANAGE_STATS);
  if (cachedProjection?.payload) {
    return cachedProjection.payload;
  }

  const refreshService = new SystemStatsProjectionRefreshService(db, {
    projectionRepo,
  });
  const refreshedProjection = await refreshService.refresh(STATS_PROJECTION_SCOPES.MANAGE_STATS);
  return refreshedProjection?.payload || { data: null };
}

/**
 * GET /api/manage/stats - 获取系统统计信息
 */
app.get('/', requirePermission('stats:read'), withCache(60), async (c) => {
  const projection = await loadStatsProjection(c.env.DB);
  return c.json({
    success: true,
    ...(projection || {}),
  });
});

/**
 * GET /api/manage/stats/uploads - 上传统计（按日期）
 */
app.get('/uploads', requirePermission('stats:read'), async (c) => {
  const { env } = c;
  const days = parseInt(c.req.query('days') || '30');

  const todayStart = getChinaDayStart();
  const startTime = todayStart - (days - 1) * 24 * 60 * 60 * 1000;

  const repo = new StatsRepository(env.DB);
  const results = await repo.getUploadTrends(startTime);

  return c.json({
    success: true,
    data: {
      period: days,
      uploads: results,
    },
  });
});

export default app;
