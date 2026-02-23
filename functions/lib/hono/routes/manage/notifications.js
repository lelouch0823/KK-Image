import { Hono } from 'hono';
import { NotificationRepository } from '../../../../repositories/NotificationRepository.js';
import { success, error } from '../../../../api/utils/response.js';
import { MSG } from '../../../../api/utils/messages.js';

const app = new Hono();

/**
 * GET / - 获取管理员通知列表
 */
app.get('/', async (c) => {
    const { env } = c;
    const limit = parseInt(c.req.query('limit') || '20');
    const unreadOnly = c.req.query('unread_only') === 'true';

    try {
        const notifyRepo = new NotificationRepository(env.DB);
        const result = await notifyRepo.listForAdmin({ unreadOnly, limit });
        return success(result);
    } catch (err) {
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
});

/**
 * POST / - 创建通知
 */
app.post('/', async (c) => {
    const { env } = c;
    try {
        const body = await c.req.json();
        const { type = 'system', title, content = '', link = '', metadata = null, orderId = null } = body;

        if (!title) {
            return error(MSG.COMMON.INVALID_PARAMS, 400);
        }

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

        return success(result, MSG.COMMON.CREATE_SUCCESS);
    } catch (err) {
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
});

/**
 * POST /:id/read - 标记通知已读
 */
app.post('/:id/read', async (c) => {
    const notificationId = c.req.param('id');
    const { env } = c;

    try {
        const notifyRepo = new NotificationRepository(env.DB);

        // 特殊 ID 'all' 处理全部已读
        if (notificationId === 'all') {
            await notifyRepo.markAllAsReadForAdmin();
        } else {
            await notifyRepo.markAsReadForAdmin(notificationId);
        }

        return success(null, MSG.COMMON.UPDATE_SUCCESS);
    } catch (err) {
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
});

export default app;
