
import { Hono } from 'hono';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { validateProductVariantBinding } from '../../../../../api/utils/validation.js';
import {
    canTransitionOrderStatus
} from '../../../../../api/utils/order-state-machine.js';
import { MSG, ORDER_STATUSES } from '../../../_shared/utils.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';
import { getManageOrderCacheUrls } from '../../_shared/cache-urls.js';
import { assertAdminFull, assertForceStatusTransitionAllowed } from './authz-helpers.js';
import { scheduleCacheInvalidation } from '../../../_shared/route-helpers.js';
import {
    resolveSalesTokens,
    scheduleOrderAndSalespersonCacheInvalidation,
    scheduleOrderNotificationCacheInvalidation,
    scheduleOrderMutationCachesInvalidation,
} from './cache-helpers.js';
import { isInsufficientStockError, isInvalidStatusTransitionError } from './error-helpers.js';

const app = new Hono();
const ADMIN_EDITABLE_FIELDS = ['status', 'name', 'brand', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline', 'quantity'];

function getAdminActor(user) {
    return {
        id: user?.id || 'admin',
        name: user?.name || 'Admin',
    };
}

async function requireOrder(repo, orderId) {
    const order = await repo.findById(orderId);
    if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);
    return order;
}

async function assertStatusTransitionAllowed({ c, user, fromStatus, toStatus, forceStatusTransition, reason }) {
    if (toStatus === undefined || toStatus === fromStatus) return;
    if (canTransitionOrderStatus(fromStatus, toStatus)) return;
    if (!forceStatusTransition) {
        throw new BadRequestError(`Invalid status transition: ${fromStatus} -> ${toStatus}`);
    }
    await assertForceStatusTransitionAllowed(c, user, reason);
}

/**
 * GET /:id - 获取订单详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new OrderRepository(env.DB);
    const order = await requireOrder(repo, id);

    // SOTA: 获取关联的文件和时间轴
    const { OrderTimelineRepository } = await import('../../../../../repositories/OrderTimelineRepository.js');
    const timelineRepo = new OrderTimelineRepository(env.DB);

    const [files, timeline] = await Promise.all([
        repo.getFiles(id),
        timelineRepo.getTimeline(id),
    ]);

    // 标记管理员已读
    await repo.markAsRead(id, 'admin');
    scheduleCacheInvalidation(c, getManageOrderCacheUrls(c));

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
 * PATCH /:id - 修改订单
 */
app.patch('/:id', async (c) => {
    const { env } = c;
    const user = c.get('user'); // 从 JWT 获取管理员信息
    const actor = getAdminActor(user);
    const id = c.req.param('id');
    const body = await c.req.json();

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireOrder(orderRepo, id);

    const { updates: updatesFromBody, reason, fileIds, productId, variantId } = body;
    const forceStatusTransition = Boolean(body?.force);
    const updatesObj = updatesFromBody || body;
    const {
        reason: _unusedReason,
        fileIds: _unusedFileIds,
        updates: _unusedUpdates,
        productId: _unusedProductId,
        variantId: _unusedVariantId,
        ...updates
    } = updatesObj;

    const { processOrderUpdate } = await import('../../../../../api/utils/order-utils.js');

    // 如果绑定了商品，从商品库获取信息覆盖提交的字段
    let finalUpdates = { ...updates };
    const hasProductIdPayload = productId !== undefined;
    const hasVariantIdPayload = variantId !== undefined;
    const effectiveProductId = hasProductIdPayload ? productId : order.productId;
    let normalizedVariantId = hasVariantIdPayload ? (variantId || null) : undefined;
    let validatedBinding = null;

    if (hasProductIdPayload || hasVariantIdPayload) {
        validatedBinding = await validateProductVariantBinding(env.DB, effectiveProductId, normalizedVariantId, { checkActive: true });
        normalizedVariantId = validatedBinding.normalizedVariantId;
        if (validatedBinding.variant) {
            finalUpdates.sku = validatedBinding.variant.sku;
        }
    }

    if (effectiveProductId) {
        const product = validatedBinding?.product || await new ProductRepository(env.DB).findById(effectiveProductId);
        if ((hasProductIdPayload || hasVariantIdPayload) && !product) {
            throw new BadRequestError('productId does not exist');
        }
        if ((hasProductIdPayload || hasVariantIdPayload) && product?.status !== 'active') {
            throw new BadRequestError('product must be active');
        }
        if (product) {
            finalUpdates.name = product.name;
            finalUpdates.brand = product.brand;
            finalUpdates.series = product.series;
            // 可以在此同步更多字段，如 material
            if (product.specifications?.material) {
                finalUpdates.material = product.specifications.material;
            }
        }
    }

    const requestedStatus = finalUpdates?.status;
    await assertStatusTransitionAllowed({
        c,
        user,
        fromStatus: order.status,
        toStatus: requestedStatus,
        forceStatusTransition,
        reason,
    });

    await processOrderUpdate({
        env,
        orderId: id,
        orderNo: order.orderNo,
        currentData: order.currentData,
        currentStatus: order.status,
        updates: finalUpdates,
        fileIds,
        productId, // 传入 product_id 以更新列
        variantId: normalizedVariantId,
        currentProductId: order.productId,
        currentVariantId: order.variantId,
        allowedFields: ADMIN_EDITABLE_FIELDS,
        actor: { type: 'admin', id: actor.id, name: actor.name },
        reason: reason || 'Admin Update',
        salespersonId: order.salespersonId, // 传入销售员ID以发送通知
        forceStatusTransition,
    });

    const notificationSalesTokens = await resolveSalesTokens(env.DB, [order.salespersonId]);
    scheduleOrderMutationCachesInvalidation(c, { salesTokens: notificationSalesTokens });

    const updatedOrder = await orderRepo.findById(id);
    return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS, data: updatedOrder });
});

/**
 * PATCH /:id/status - 更新订单状态
 */
app.patch('/:id/status', async (c) => {
    const { env } = c;
    const user = c.get('user');
    const actor = getAdminActor(user);
    const id = c.req.param('id');
    const { status, note, force } = await c.req.json();
    if (!ORDER_STATUSES.includes(status)) {
        throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
    }

    const repo = new OrderRepository(env.DB);
    const order = await requireOrder(repo, id);

    const oldStatus = order.status;
    const forceStatusTransition = Boolean(force);
    await assertStatusTransitionAllowed({
        c,
        user,
        fromStatus: oldStatus,
        toStatus: status,
        forceStatusTransition,
        reason: note,
    });

    let success = false;
    try {
        success = await repo.updateStatus(id, status, 'admin', { forceStatusTransition });
    } catch (error) {
        if (isInsufficientStockError(error)) {
            throw new BadRequestError('Insufficient stock: cannot mark order as delivered');
        }
        if (isInvalidStatusTransitionError(error)) {
            throw new BadRequestError(`Invalid status transition: ${oldStatus} -> ${status}`);
        }
        throw error;
    }

    if (success) {
        // 记录状态变更到时间轴
        await repo.timelineRepo.addTimelineEntry(id, {
            actionType: 'status_changed',
            actorType: 'admin',
            actorId: actor.id,
            actorName: actor.name,
            oldValue: oldStatus,
            newValue: status,
            reason: note || '',
        });

        // SOTA: 发送状态变更通知给销售
        if (order.salespersonId) {
            const { createOrderNotification } = await import('../../../../../api/utils/order-utils.js');
            await createOrderNotification(env.DB, {
                event: 'ORDER_STATUS_CHANGED',
                orderId: id,
                orderNo: order.orderNo,
                receiver: 'sales',
                salespersonId: order.salespersonId,
                actorName: actor.name,
                extra: { status }
            });
        }
    } else {
        throw new BadRequestError(MSG.COMMON.OP_FAILED);
    }

    const notificationSalesTokens = await resolveSalesTokens(env.DB, [order.salespersonId]);
    scheduleOrderMutationCachesInvalidation(c, { salesTokens: notificationSalesTokens });

    return c.json({ success: true, message: MSG.ORDER.STATUS_CHANGED });
});

/**
 * POST /:id/comment - 添加订单备注/留言
 */
app.post('/:id/comment', async (c) => {
    const { env } = c;
    const user = c.get('user');
    const actor = getAdminActor(user);
    const id = c.req.param('id');
    // SOTA: Payload key mismatch fix (frontend sends 'comment', backend expected 'content')
    const { comment } = await c.req.json();

    if (!comment) {
        throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);
    }

    const repo = new OrderRepository(env.DB);
    // SOTA: Use correct method addTimelineEntry instead of add
    await repo.timelineRepo.addTimelineEntry(id, {
        actionType: 'comment',
        actorType: 'admin',
        actorId: actor.id,
        actorName: actor.name,
        comment
    });
    await repo.setUnread(id, 'admin');

    // SOTA: Send notification to salesperson if assigned
    const order = await repo.findById(id);
    if (order && order.salespersonId) {
        const { createOrderNotification } = await import('../../../../../api/utils/order-utils.js');
        await createOrderNotification(env.DB, {
            event: 'ORDER_COMMENTED_BY_ADMIN',
            orderId: id,
            orderNo: order.orderNo,
            receiver: 'sales',
            salespersonId: order.salespersonId,
            actorName: actor.name,
            extra: { comment }
        });
    }

    const notificationSalesTokens = await resolveSalesTokens(env.DB, [order?.salespersonId]);
    scheduleOrderNotificationCacheInvalidation(c, { salesTokens: notificationSalesTokens });
    return c.json({ success: true, message: MSG.ORDER.COMMENT_ADDED });
});

/**
 * DELETE /:id - 彻底删除订单 (Cascading Delete)
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const user = c.get('user');
    await assertAdminFull(c, user);

    const id = c.req.param('id');
    const orderRepo = new OrderRepository(env.DB);
    const order = await orderRepo.findById(id);
    const notificationSalesTokens = await resolveSalesTokens(env.DB, [order?.salespersonId]);

    await orderRepo.deleteOrderCascading(id);

    scheduleOrderAndSalespersonCacheInvalidation(c, { salesTokens: notificationSalesTokens });

    return c.json({ success: true, message: MSG.ORDER.DELETE_SUCCESS });
});

export default app;
