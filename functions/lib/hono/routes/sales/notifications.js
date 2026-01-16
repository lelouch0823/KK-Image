import { Hono } from 'hono';
import { NotificationRepository } from '../../../../repositories/NotificationRepository.js';

const app = new Hono();

/**
 * GET / - 获取通知
 */
app.get('/', async (c) => {
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
    const { env } = c;

    const notifyRepo = new NotificationRepository(env.DB);
    await notifyRepo.markAsRead(notificationId, salesperson.id);

    return c.json({ success: true, message: '已读成功' });
});

export default app;
