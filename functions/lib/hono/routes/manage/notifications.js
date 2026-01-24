import { Hono } from 'hono';
import { NotificationRepository } from '../../../../repositories/NotificationRepository.js';

const app = new Hono();

/**
 * GET / - 获取管理员通知列表
 */
app.get('/', async (c) => {
    const { env } = c;
    const limit = parseInt(c.req.query('limit') || '20');
    const unreadOnly = c.req.query('unread_only') === 'true';

    const notifyRepo = new NotificationRepository(env.DB);
    const result = await notifyRepo.listForAdmin({ unreadOnly, limit });

    return c.json({ success: true, data: result });
});

/**
 * POST /:id/read - 标记通知已读
 */
app.post('/:id/read', async (c) => {
    const notificationId = c.req.param('id');
    const { env } = c;

    const notifyRepo = new NotificationRepository(env.DB);

    // 特殊 ID 'all' 处理全部已读
    if (notificationId === 'all') {
        await notifyRepo.markAllAsReadForAdmin();
    } else {
        await notifyRepo.markAsRead(notificationId);
    }

    return c.json({ success: true, message: '已读成功' });
});

export default app;
