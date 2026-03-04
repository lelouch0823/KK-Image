import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateOrderSchema, AddCommentSchema } from '../../schemas/sales.js';
import { MSG, generateId, generateOrderNo, triggerWebhook } from '../../_shared/utils.js';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';
import { validateProductVariantBinding } from '../../../../api/utils/validation.js';
import { parsePagination, requireEntity } from '../../_shared/route-helpers.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../errors.js';
import { withCache } from '../../middleware/cache.js';
import {
    invalidateOrderNotificationCaches,
    scheduleSalesOrderListCacheInvalidation,
    scheduleSalesOrderMutationCachesInvalidation,
    scheduleSalesCommentCachesInvalidation,
    scheduleOrderAndSalespersonCacheInvalidation,
} from './orders-cache-helpers.js';

const app = new Hono();

app.onError((err, c) => {
    const statusCode = Number(err?.statusCode || 500);
    const code = err?.code || 'INTERNAL_ERROR';
    const error = err?.message || 'Internal Server Error';
    return c.json({ success: false, error, code }, statusCode);
});

async function requireSalesOrder(orderRepo, orderId, salespersonId) {
    return requireEntity(
        orderRepo.findByIdAndSalesperson(orderId, salespersonId),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );
}

/**
 * GET / - 获取订单列表
 */
app.get('/', withCache(20), async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;
    const { page, limit } = parsePagination(c);
    const status = c.req.query('status');

    const orderRepo = new OrderRepository(env.DB);
    const result = await orderRepo.listBySalesperson(salesperson.id, {
        status,
        page,
        limit
    });

    return c.json({
        success: true,
        data: {
            orders: result.items,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            }
        }
    });
});

/**
 * POST / - 创建订单
 */
app.post('/', zValidator('json', CreateOrderSchema), async (c) => {
    const salesperson = c.get('salesperson');
    const token = c.req.param('token');
    const data = c.req.valid('json');
    const { env } = c;
    const orderRepo = new OrderRepository(env.DB);

    const orderId = generateId();
    const orderNo = generateOrderNo();
    const variantId = data.variantId ?? null;

    await validateProductVariantBinding(env.DB, data.productId || null, variantId, { checkActive: true });

    // 1. 创建订单（事务）
    await orderRepo.create({
        id: orderId,
        orderNo,
        salespersonId: salesperson.id,
        data: {
            name: data.name,
            size: data.size,
            color: data.color,
            material: data.material,
            remark: data.remark,
            deadline: data.deadline,
            brand: data.brand,
            series: data.series,
            sku: data.sku,
        },
        quantity: data.quantity,
        mainImageId: data.fileIds[0] || null,
        fileIds: data.fileIds,
        productId: data.productId || null,
        variantId,
        timeline: {
            actionType: 'created',
            actorType: 'salesperson',
            actorId: salesperson.id,
            actorName: salesperson.name,
        },
    });

    // 创建订单后将临时上传文件归档到订单目录，避免文件滞留在根目录
    const fileIds = Array.isArray(data.fileIds) ? data.fileIds.filter(Boolean) : [];
    if (fileIds.length > 0) {
        try {
            const { ensureOrderFolder, moveFilesToFolder } = await import('../../../../api/utils/folder-utils.js');
            const orderFolderId = await ensureOrderFolder(env, orderNo);
            await moveFilesToFolder(env, fileIds, orderFolderId);
        } catch (error) {
            console.error('Order file archiving error (sales create):', error);
        }
    }

    // 2. 发送 WEBHOOK & 通知 (后台任务)
    c.executionCtx.waitUntil((async () => {
        try {
            const { createOrderNotification } = await import('../../../../api/utils/order-utils.js');
            await createOrderNotification(env.DB, {
                event: 'ORDER_CREATED',
                orderId,
                orderNo,
                receiver: 'admin',
                actorName: salesperson.name,
                salespersonId: salesperson.id,
            });

            await invalidateOrderNotificationCaches(c);

            await triggerWebhook(env, 'order.created', { orderId, orderNo, salesperson: salesperson.name });
        } catch (e) {
            console.error('Async notify/webhook failed:', e);
        }
    })());

    scheduleOrderAndSalespersonCacheInvalidation(c, { salesToken: token });

    return c.json({ success: true, data: { id: orderId, orderNo } }, 201);
});

/**
 * GET /:id - 获取订单详情
 */
app.get('/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const token = c.req.param('token');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireSalesOrder(orderRepo, orderId, salesperson.id);

    const { OrderTimelineRepository } = await import('../../../../repositories/OrderTimelineRepository.js');
    const tplRepo = new OrderTimelineRepository(env.DB);

    const [files, timeline] = await Promise.all([
        orderRepo.getFiles(orderId),
        tplRepo.getTimeline(orderId),
    ]);

    // Mark as read
    await orderRepo.markAsRead(orderId, 'sales');
    scheduleSalesOrderListCacheInvalidation(c, { salesToken: token });

    return c.json({
        success: true,
        data: {
            ...order,
            files,
            timeline,
        }
    });
});

/**
 * PATCH /:id/read - 标记订单已读
 */
app.patch('/:id/read', async (c) => {
    const salesperson = c.get('salesperson');
    const token = c.req.param('token');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    await requireSalesOrder(orderRepo, orderId, salesperson.id);
    await orderRepo.markAsRead(orderId, 'sales');
    scheduleSalesOrderListCacheInvalidation(c, { salesToken: token });

    return c.json({ success: true, message: MSG.ORDER.ALREADY_READ });
});

/**
 * PATCH /:id - 修改订单
 */
app.patch('/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const token = c.req.param('token');
    const orderId = c.req.param('id');
    const body = await c.req.json();
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireSalesOrder(orderRepo, orderId, salesperson.id);

    const editableStatuses = ['pending', 'rejected', 'void'];
    if (!editableStatuses.includes(order.status)) {
        throw new ForbiddenError(MSG.ORDER.ONLY_PENDING_CAN_EDIT);
    }

    const { updates: updatesFromBody, reason, fileIds, productId, variantId } = body;
    const updatesObj = updatesFromBody || body;
    const {
        reason: _unusedReason,
        fileIds: _unusedFileIds,
        updates: _unusedUpdates,
        productId: _unusedProductId,
        variantId: _unusedVariantId,
        ...updates
    } = updatesObj;

    if (!reason || !reason.trim()) {
        throw new BadRequestError(MSG.ORDER.REASON_REQUIRED);
    }

    const { processOrderUpdate } = await import('../../../../api/utils/order-utils.js');

    const hasProductIdPayload = productId !== undefined;
    const hasVariantIdPayload = variantId !== undefined;
    const effectiveProductId = hasProductIdPayload ? productId : order.productId;
    let normalizedVariantId = hasVariantIdPayload ? (variantId || null) : undefined;

    if (hasProductIdPayload || hasVariantIdPayload) {
        const binding = await validateProductVariantBinding(env.DB, effectiveProductId, normalizedVariantId, { checkActive: true });
        normalizedVariantId = binding.normalizedVariantId;
    }

    // 销售端允许修改的字段
    // SOTA: productId 是顶级表列，通过 options.productId 单独传递处理，不应加入 JSON data 字段列表
    const SALES_EDITABLE_FIELDS = ['name', 'brand', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline', 'quantity'];

    const _result = await processOrderUpdate({
        env,
        orderId,
        orderNo: order.orderNo,
        currentData: order.currentData,
        currentStatus: order.status,
        updates,
        fileIds,
        productId,
        variantId: normalizedVariantId,
        currentProductId: order.productId,
        currentVariantId: order.variantId,
        allowedFields: SALES_EDITABLE_FIELDS,
        actor: { type: 'salesperson', id: salesperson.id, name: salesperson.name },
        reason: reason.trim(),
    });

    if (['rejected', 'void'].includes(order.status)) {
        await orderRepo.updateStatus(orderId, 'pending', 'sales');
    }

    scheduleSalesOrderMutationCachesInvalidation(c, { salesToken: token });

    return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS });
});

/**
 * DELETE /:id - 作废订单
 */
app.delete('/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const token = c.req.param('token');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireSalesOrder(orderRepo, orderId, salesperson.id);
    if (order.status !== 'pending') throw new ForbiddenError(MSG.ORDER.ONLY_PENDING_CAN_VOID);

    await orderRepo.updateStatus(orderId, 'void', 'sales');

    // SOTA: 记录时间轴
    const { OrderTimelineRepository } = await import('../../../../repositories/OrderTimelineRepository.js');
    const tplRepo = new OrderTimelineRepository(env.DB);
    await tplRepo.addTimelineEntry(orderId, {
        actionType: 'status_changed',
        actorType: 'salesperson',
        actorId: salesperson.id,
        actorName: salesperson.name,
        oldValue: order.status,
        newValue: 'void',
        reason: 'Salesperson voided the order',
    });

    // SOTA: 通知管理员
    const { createOrderNotification } = await import('../../../../api/utils/order-utils.js');
    await createOrderNotification(env.DB, {
        event: 'ORDER_UPDATED_BY_SALES',
        orderId: orderId,
        orderNo: order.orderNo,
        receiver: 'admin',
        actorName: salesperson.name,
        extra: { status: 'void' }
    });

    scheduleSalesOrderMutationCachesInvalidation(c, { salesToken: token });

    return c.json({ success: true, message: MSG.ORDER.VOID_SUCCESS });
});

/**
 * POST /:id/comment - 添加留言
 */
app.post('/:id/comment', zValidator('json', AddCommentSchema), async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const { comment } = c.req.valid('json');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireSalesOrder(orderRepo, orderId, salesperson.id);

    const { OrderTimelineRepository } = await import('../../../../repositories/OrderTimelineRepository.js');
    const tplRepo = new OrderTimelineRepository(env.DB);

    await tplRepo.addTimelineEntry(orderId, {
        actionType: 'comment',
        actorType: 'salesperson',
        actorId: salesperson.id,
        actorName: salesperson.name,
        comment: comment.trim(),
    });

    await orderRepo.setUnread(orderId, 'sales');

    // SOTA: Send notification to admin
    const { createOrderNotification } = await import('../../../../api/utils/order-utils.js');
    await createOrderNotification(env.DB, {
        event: 'ORDER_COMMENTED_BY_SALES',
        orderId,
        orderNo: order.orderNo,
        receiver: 'admin',
        actorName: salesperson.name,
        extra: { comment: comment.trim() }
    });

    scheduleSalesCommentCachesInvalidation(c);
    return c.json({ success: true, message: MSG.ORDER.COMMENT_ADDED });
});

export default app;
