import { Hono } from 'hono';
import { NotificationRepository } from '../../../../repositories/NotificationRepository.js';
import { MSG } from '../../_shared/utils.js';
import { BadRequestError } from '../../errors.js';
import { withCache } from '../../middleware/cache.js';
import { requirePermission } from '../../middleware/auth.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'notifications', action: 'notification.create', severity: 'normal', targetType: 'notification' },
    { method: 'POST', path: '/:id/read', domain: 'notifications', action: 'notification.read', severity: 'normal', targetType: 'notification' },
]);

/**
 * GET / - 获取管理员通知列表
 */
app.get('/', requirePermission('notifications:read'), withCache(15), async (c) => {
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
app.post('/', requirePermission('notifications:write'), async (c) => {
    const { env } = c;
    const body = await c.req.json();
    const { type = 'system', title, content = '', link = '', metadata = null, orderId = null } = body;

    if (!title) throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);

    await publishSingleDomainEventAndPoll(c, {
        event_type: 'admin_notification_created',
        aggregate_type: 'notification',
        aggregate_id: orderId || 'admin',
        payload: {
            type,
            title,
            content,
            link,
            order_id: orderId,
            metadata,
        },
    }, `admin-notification-create:${orderId || 'admin'}`);
    scheduleAuditEvent(c, {
        domain: 'notifications',
        action: 'notification.create',
        result: 'success',
        severity: 'normal',
        targetType: 'notification',
        targetId: null,
        target_label: title,
        summary: `Created notification ${title}`,
        metadata: { type, orderId },
    });

    return c.json({ success: true, message: MSG.COMMON.CREATE_SUCCESS, data: null });
});

/**
 * POST /:id/read - 标记通知已读
 */
app.post('/:id/read', requirePermission('notifications:write'), async (c) => {
    const notificationId = c.req.param('id');
    const { env } = c;

    const notifyRepo = new NotificationRepository(env.DB);

    // 特殊 ID 'all' 处理全部已读
    if (notificationId === 'all') {
        await notifyRepo.markAllAsReadForAdmin();
    } else {
        await notifyRepo.markAsReadForAdmin(notificationId);
    }

    await publishSingleDomainEventAndPoll(c, {
        event_type: 'notification_read_by_admin',
        aggregate_type: 'notification',
        aggregate_id: notificationId,
        payload: {
            notification_id: notificationId,
        },
    }, `notification-read-admin:${notificationId}`);
    scheduleAuditEvent(c, {
        domain: 'notifications',
        action: 'notification.read',
        result: 'success',
        severity: 'normal',
        targetType: 'notification',
        targetId: notificationId,
        target_label: notificationId,
        summary: notificationId === 'all' ? 'Marked all notifications as read' : `Marked notification ${notificationId} as read`,
    });

    return c.json({ success: true, message: MSG.COMMON.UPDATE_SUCCESS });
});

export default app;
