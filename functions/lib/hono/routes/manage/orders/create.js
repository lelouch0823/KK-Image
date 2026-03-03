
import { Hono } from 'hono';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { validateProductVariantBinding } from '../../../../../api/utils/validation.js';
import { MSG, ORDER_STATUSES } from '../../../_shared/utils.js';
import { getSalespersonAccessTokens } from '../../../_shared/route-helpers.js';
import { BadRequestError } from '../../../errors.js';
import { invalidateCache } from '../../../middleware/cache.js';
import { getOrderAndSalespersonCacheUrls, getOrderNotificationCacheUrls } from '../../_shared/cache-urls.js';

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
    const variantId = body.variantId ?? null;
    const notificationSalesTokens = await getSalespersonAccessTokens(env.DB, [body.salespersonId]);

    await validateProductVariantBinding(env.DB, body.productId || null, variantId, { checkActive: true });

    if (body.status && !ORDER_STATUSES.includes(body.status)) {
        throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
    }

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
        quantity: body.quantity || 1,
        // Admin can set initial status
        status: body.status || 'pending',
        productId: body.productId || null,
        variantId,
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

    // 创建订单后将临时上传文件归档到订单目录，避免文件长期留在根目录
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter(Boolean) : [];
    if (fileIds.length > 0) {
        try {
            const { ensureOrderFolder, moveFilesToFolder } = await import('../../../../../api/utils/folder-utils.js');
            const orderFolderId = await ensureOrderFolder(env, orderNo);
            await moveFilesToFolder(env, fileIds, orderFolderId);
        } catch (error) {
            console.error('Order file archiving error (manage create):', error);
        }
    }

    // 2. 通知销售人员 (Async)
    c.executionCtx.waitUntil((async () => {
        try {
            const notifyRepo = new NotificationRepository(env.DB);
            // Notify Salesperson
            await notifyRepo.create({
                type: 'order',
                title: JSON.stringify({ key: 'notification.orderAssigned', params: { orderNo } }),
                content: `Order ${orderNo} has been assigned to you`,
                receiver: 'sales',
                salespersonId: body.salespersonId,
                orderId,
                metadata: { actorName: 'Admin' },
            });

            await invalidateCache(getOrderNotificationCacheUrls(c, { salesTokens: notificationSalesTokens }));

            // Webhook (if needed for admin creation)
            await triggerWebhook(env, 'order.created_by_admin', { orderId, orderNo, admin: user?.name });
        } catch (e) {
            console.error('Async notify failed:', e);
        }
    })());

    c.executionCtx.waitUntil(invalidateCache(getOrderAndSalespersonCacheUrls(c, { salesTokens: notificationSalesTokens })));

    return c.json({ success: true, data: { id: orderId, orderNo } }, 201);
});

/**
 * POST /batch - 批量操作接口
 */
app.post('/batch', async (c) => {
    const { env } = c;
    const user = c.get('user');
    const { ids, action, value, reason } = await c.req.json();
    const repo = new OrderRepository(env.DB);
    const actorName = user?.name || 'Admin';
    const normalizedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];

    if (normalizedIds.length === 0) {
        throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);
    }

    const ACTION_STATUS_MAP = {
        confirm: 'confirmed',
        reject: 'rejected',
        void: 'void',
    };

    let normalizedAction = action;
    let normalizedStatus = value;
    if (action in ACTION_STATUS_MAP) {
        normalizedAction = 'status';
        normalizedStatus = ACTION_STATUS_MAP[action];
    }

    if (normalizedAction !== 'status' || !ORDER_STATUSES.includes(normalizedStatus)) {
        throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
    }

    if (normalizedAction === 'status') {
        const updateReason = reason || MSG.ORDER.ACTIONS.BATCH_PREFIX + MSG.ORDER.ACTIONS[normalizedStatus];
        
        // 1. 先查询需要通知的订单信息
        const { results: orders } = await env.DB.prepare(
            `SELECT id, order_no, salesperson_id FROM orders WHERE id IN (${normalizedIds.map(() => '?').join(',')})`
        ).bind(...normalizedIds).all();
        const notificationSalesTokens = await getSalespersonAccessTokens(env.DB, (orders || []).map((o) => o.salesperson_id));

        // 2. 更新状态
        await repo.batchUpdateStatus(normalizedIds, normalizedStatus, {
            actorType: 'admin',
            actorName: actorName,
            reason: updateReason
        });

        // 3. SOTA: 发送批量通知给销售
        if (orders && orders.length > 0) {
            const notifications = orders.filter(o => o.salesperson_id).map(order => ({
                event: 'ORDER_BATCH_STATUS_CHANGED',
                orderId: order.id,
                orderNo: order.order_no,
                receiver: 'sales',
                salespersonId: order.salesperson_id,
                actorName: actorName,
                extra: { status: normalizedStatus }
            }));

            if (notifications.length > 0) {
                const { createBatchOrderNotifications } = await import('../../../../../api/utils/order-utils.js');
                await createBatchOrderNotifications(env.DB, notifications);
            }
        }

        c.executionCtx.waitUntil(invalidateCache(getOrderNotificationCacheUrls(c, { salesTokens: notificationSalesTokens })));
        c.executionCtx.waitUntil(invalidateCache(getOrderAndSalespersonCacheUrls(c, { salesTokens: notificationSalesTokens })));
    }

    return c.json({ success: true, message: MSG.ORDER.BATCH_RESULT.replace('{valid}', normalizedIds.length) });
});

export default app;
