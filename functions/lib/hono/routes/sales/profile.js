import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { BindWechatSchema } from '../../schemas/sales.js';
import { SalespersonRepository } from '../../../../repositories/SalespersonRepository.js';
import { withCache } from '../../middleware/cache.js';

const app = new Hono();

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
        }
    });
});

/**
 * POST /bind-wechat - 绑定微信
 */
app.post('/bind-wechat', zValidator('json', BindWechatSchema), async (c) => {
    const salesperson = c.get('salesperson');
    const { code } = c.req.valid('json');
    const { env } = c;

    if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
        return c.json({ success: false, error: '微信登录未配置' }, 503);
    }

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WECHAT_APPID}&secret=${env.WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json();

    if (wxData.errcode) throw new Error(wxData.errmsg);
    const { openid } = wxData;

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    await repo.updateWechatOpenid(salesperson.id, openid);

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
        }
    });
});

export default app;
