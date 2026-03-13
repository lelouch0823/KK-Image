import { Hono } from 'hono';
import { NotificationRepository } from '../../../../repositories/NotificationRepository.js';
import { withCache } from '../../middleware/cache.js';
import { getSalesNotificationCacheUrls } from '../_shared/cache-urls.js';
import { scheduleCacheInvalidation } from '../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/:id/read', domain: 'sales-notifications', action: 'sales.notification.read', severity: 'normal', targetType: 'notification' },
]);

/**
 * GET / - 获取通知
 */
app.get('/', withCache(15), async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;
    const limit = parseInt(c.req.query('limit') || '20');
    const unreadOnly = c.req.query('unread_only') === 'true';

    const notifyRepo = new NotificationRepository(env.DB);
    const result = await notifyRepo.listForSalesperson(salesperson.id, { unreadOnly, limit });

    return c.json({ success: true, data: result });
});

/**
 * POST /:id/read - 标记通知已读
 */
app.post('/:id/read', async (c) => {
    const salesperson = c.get('salesperson');
    const notificationId = c.req.param('id');
    const token = c.req.param('token');
    const { env } = c;

    const notifyRepo = new NotificationRepository(env.DB);
    if (notificationId === 'all') {
        await notifyRepo.markAllAsReadForSalesperson(salesperson.id);
    } else {
        await notifyRepo.markAsReadForSalesperson(notificationId, salesperson.id);
    }

    scheduleCacheInvalidation(c, getSalesNotificationCacheUrls(c, token));
    scheduleAuditEvent(c, {
        domain: 'sales-notifications',
        action: 'sales.notification.read',
        result: 'success',
        severity: 'normal',
        targetType: 'notification',
        targetId: notificationId,
        target_label: notificationId,
        summary: notificationId === 'all' ? 'Marked all sales notifications as read' : `Marked sales notification ${notificationId} as read`,
    });

    return c.json({ success: true, message: '已读成功' });
});

export default app;
