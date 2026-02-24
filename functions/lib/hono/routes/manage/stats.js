import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { getChinaDayStart } from '../../_shared/utils.js';
import { StatsRepository } from '../../../../repositories/StatsRepository.js';

const app = new Hono();

/**
 * GET /api/manage/stats - 获取系统统计信息
 */
app.get('/', requirePermission('stats:read'), withCache(60), async (c) => {
  const { env } = c;

  const todayStart = getChinaDayStart();
  const repo = new StatsRepository(env.DB);
  const data = await repo.getGlobalStats(todayStart);

  return c.json({
    success: true,
    data: {
      // 转换为前端 Stats.vue 所需格式
      storage: {
        totalFiles: data.files.total,
        totalSize: data.files.totalSize,
        todayUploads: data.files.todayUploads,
        used: data.files.totalSize,
        limit: null
      },
      traffic: data.traffic,
      health: {
        status: data.status,
        fileTypes: data.fileTypes
      },
      generatedAt: new Date().toISOString(),
    },
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
