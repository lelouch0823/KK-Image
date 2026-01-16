import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { MSG, getChinaDayStart } from '../../_shared/utils.js';
import { StatsRepository } from '../../../../repositories/StatsRepository.js';

const app = new Hono();

/**
 * GET /api/manage/stats - 获取系统统计信息
 */
app.get('/', requirePermission('stats:read'), withCache(60), async (c) => {
  const { env } = c;

  try {
    const todayStart = getChinaDayStart();
    const repo = new StatsRepository(env.DB);
    const data = await repo.getGlobalStats(todayStart);

    return c.json({
      success: true,
      data: {
        ...data,
        storage: {
          used: data.files.totalSize,
          limit: null
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * GET /api/manage/stats/uploads - 上传统计（按日期）
 */
app.get('/uploads', requirePermission('stats:read'), async (c) => {
  const { env } = c;
  const days = parseInt(c.req.query('days') || '30');

  try {
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
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

export default app;
