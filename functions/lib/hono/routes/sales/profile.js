import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { BindWechatSchema } from '../../schemas/sales.js';
import { SalespersonRepository } from '../../../../repositories/SalespersonRepository.js';
import { getWeChatOpenid } from '../../../../services/WeChatService.js';
import { withCache } from '../../middleware/cache.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/bind-wechat',
    domain: 'sales-profile',
    action: 'sales.profile.bind_wechat',
    severity: 'high',
    targetType: 'salesperson',
  },
]);

/**
 * GET /auth - 获取当前认证状态
 */
app.get('/auth', async (c) => {
  const salesperson = c.get('salesperson');
  return c.json({
    success: true,
    data: {
      id: salesperson.id,
      name: salesperson.name,
      store: salesperson.store,
      phone: salesperson.phone,
    },
  });
});

/**
 * POST /bind-wechat - 绑定微信
 */
app.post('/bind-wechat', zValidator('json', BindWechatSchema), async (c) => {
  const salesperson = c.get('salesperson');
  const { code } = c.req.valid('json');
  const { env } = c;

  let openid;
  try {
    const wxData = await getWeChatOpenid(env, code);
    openid = wxData.openid;
  } catch (err) {
    if (err.message === '微信登录未配置') {
      return c.json({ success: false, error: '微信登录未配置' }, 503);
    }
    throw err;
  }

  const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
  await repo.updateWechatOpenid(salesperson.id, openid);
  scheduleAuditEvent(c, {
    domain: 'sales-profile',
    action: 'sales.profile.bind_wechat',
    result: 'success',
    severity: 'high',
    targetType: 'salesperson',
    targetId: salesperson.id,
    target_label: salesperson.name,
    summary: `${salesperson.name} bound WeChat`,
  });

  return c.json({ success: true, message: '绑定成功' });
});

/**
 * GET /stats - 获取统计
 */
app.get('/stats', withCache(20), async (c) => {
  const salesperson = c.get('salesperson');
  const { env } = c;

  const { OrderStatsRepository } = await import('../../../../repositories/OrderStatsRepository.js');
  const { getChinaDayStart, getChinaDateStr } = await import('../../../../api/utils/date.js');

  const statsRepo = new OrderStatsRepository(env.DB);
  const todayStart = getChinaDayStart();
  const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

  const stats = await statsRepo.getSalesFullStats(salesperson.id, monthStart);

  // 格式化趋势数据 (补全缺失日期)
  const trendMap = new Map();
  stats.trend.forEach((row) => {
    trendMap.set(row.date, row.count);
  });

  const monthlyTrend = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = getChinaDateStr(todayStart - i * 24 * 60 * 60 * 1000);
    monthlyTrend.push({ date: dateStr, count: trendMap.get(dateStr) || 0 });
  }

  return c.json({
    success: true,
    data: {
      totalOrders: stats.total,
      completedOrders: stats.completed,
      monthOrders: stats.month,
      monthlyTrend,
    },
  });
});

export default app;
