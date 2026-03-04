import { Hono } from 'hono';
import { NotificationRepository } from '../../../../repositories/NotificationRepository.js';
import { MSG } from '../../_shared/utils.js';
import { BadRequestError } from '../../errors.js';
import { withCache, invalidateCache } from '../../middleware/cache.js';
import { getManageNotificationCacheUrls } from '../_shared/cache-urls.js';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();

/**
 * GET / - 获取管理员通知列表
 */
app.get('/', requirePermission('read'), withCache(15), async (c) => {
    const { env } = c;
    const limit = parseInt(c.req.query('limit') || '20');
    const unreadOnly = c.req.query('unread_only') === 'true';

    const notifyRepo = new NotificationRepository(env.DB);
    const result = await notifyRepo.listForAdmin({ unreadOnly, limit });
    return c.json({ success: true, data: result });
});

/**
 * POST / - 创建通知
 */
app.post('/', requirePermission('write'), async (c) => {
    const { env } = c;
    const body = await c.req.json();
    const { type = 'system', title, content = '', link = '', metadata = null, orderId = null } = body;

    if (!title) throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);

    const notifyRepo = new NotificationRepository(env.DB);
    const result = await notifyRepo.create({
        type,
        title,
        content,
        link,
        receiver: 'admin',
        orderId,
        metadata,
    });

    c.executionCtx.waitUntil(invalidateCache(getManageNotificationCacheUrls(c)));

    return c.json({ success: true, message: MSG.COMMON.CREATE_SUCCESS, data: result });
});

/**
 * POST /:id/read - 标记通知已读
 */
app.post('/:id/read', requirePermission('write'), async (c) => {
    const notificationId = c.req.param('id');
    const { env } = c;

    const notifyRepo = new NotificationRepository(env.DB);

    // 特殊 ID 'all' 处理全部已读
    if (notificationId === 'all') {
        await notifyRepo.markAllAsReadForAdmin();
    } else {
        await notifyRepo.markAsReadForAdmin(notificationId);
    }

    c.executionCtx.waitUntil(invalidateCache(getManageNotificationCacheUrls(c)));

    return c.json({ success: true, message: MSG.COMMON.UPDATE_SUCCESS });
});

export default app;
