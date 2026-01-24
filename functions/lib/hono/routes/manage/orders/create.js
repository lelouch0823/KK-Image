
import { Hono } from 'hono';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { MSG, ORDER_STATUSES } from '../../../_shared/utils.js';

const app = new Hono();

/**
 * POST / - 管理端创建订单
 */
app.post('/', async (c) => {
    const { env } = c;
    const body = await c.req.json();
    const user = c.get('user'); // Admin user

    // Dynamic import to avoid top-level issues if any
    const { generateId, generateOrderNo, triggerWebhook } = await import('../../../_shared/utils.js');
    const { NotificationRepository } = await import('../../../../../repositories/NotificationRepository.js');

    // Validation (Simple version, or reuse schema)
    if (!body.productName || !body.salespersonId) {
        return c.json({ success: false, error: 'Product Name and Salesperson are required' }, 400);
    }

    const orderRepo = new OrderRepository(env.DB);
    const orderId = generateId();
    const orderNo = generateOrderNo();

    // 1. 创建订单
    await orderRepo.create({
        id: orderId,
        orderNo,
        salespersonId: body.salespersonId,
        data: {
            name: body.productName,
            brand: body.brand || '',
            series: body.series || '',
            sku: body.sku || '',
            size: body.size || '',
            color: body.color || '',
            material: body.material || '',
            remark: body.remark || '',
            deadline: body.deadline || '',
        },
        // Admin can set initial status
        status: body.status || 'pending',
        mainImageId: body.fileIds?.[0] || null,
        fileIds: body.fileIds || [],
        timeline: {
            actionType: 'created',
            actorType: 'admin',
            actorId: user?.id || 'admin',
            actorName: user?.name || 'Admin',
            comment: 'Admin created order', // Optional context
        },
    });

    // 2. 通知销售人员 (Async)
    c.executionCtx.waitUntil((async () => {
        try {
            const notifyRepo = new NotificationRepository(env.DB);
            // Notify Salesperson
            await notifyRepo.create({
                event: 'ORDER_ASSIGNED', // Or ORDER_CREATED
                orderId,
                orderNo,
                receiver: body.salespersonId, // Target the salesperson
                actorName: 'Admin',
            });

            // Webhook (if needed for admin creation)
            await triggerWebhook(env, 'order.created_by_admin', { orderId, orderNo, admin: user?.name });
        } catch (e) {
            console.error('Async notify failed:', e);
        }
    })());

    return c.json({ success: true, data: { id: orderId, orderNo } }, 201);
});

/**
 * POST /batch - 批量操作接口
 */
app.post('/batch', async (c) => {
    const { env } = c;
    const { ids, action, value, reason } = await c.req.json();
    const repo = new OrderRepository(env.DB);

    if (action === 'status') {
        await repo.batchUpdateStatus(ids, value, {
            actorType: 'admin',
            reason: reason || MSG.ORDER.ACTIONS.BATCH_PREFIX + MSG.ORDER.ACTIONS[value]
        });
    }

    return c.json({ success: true, message: MSG.ORDER.BATCH_RESULT.replace('{valid}', ids.length) });
});

export default app;
