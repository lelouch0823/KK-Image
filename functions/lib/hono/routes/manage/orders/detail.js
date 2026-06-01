
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { UpdateAdminOrderSchema, UpdateOrderStatusSchema, AddOrderCommentSchema, DeliveryConfirmationSchema } from '../../../schemas/order.js';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { validateProductVariantBinding } from '../../../../../api/utils/validation.js';
import {
    canTransitionOrderStatus
} from '../../../../../api/utils/order-state-machine.js';
import { MSG, ORDER_STATUSES } from '../../../../../_shared/utils.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';
import { assertAdminFull, assertForceStatusTransitionAllowed } from './authz-helpers.js';
import { requireEntity } from '../../../_shared/route-helpers.js';
import { isInsufficientStockError, isInvalidStatusTransitionError } from './error-helpers.js';
import { DemandService } from '../../../../../services/DemandService.js';
import { withCache } from '../../../middleware/cache.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import { publishSingleDomainEventAndPoll } from '../../../_shared/domain-outbox.js';
import { syncOrderDemandTransitions, syncOrderDemandTransitionsByLines } from '../../../../../api/utils/order-demand-sync.js';
import { buildOrderBindingSnapshot } from '../../../../../api/utils/order-binding-snapshot.js';
import { OrderDeliveryService } from '../../../../../services/OrderDeliveryService.js';
import { listOrderReturnHistory, listOrderShipmentHistory } from '../../../../../repositories/order/history-queries.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'PATCH', path: '/:id', domain: 'orders', action: 'order.update', severity: 'high', targetType: 'order' },
    { method: 'PATCH', path: '/:id/status', domain: 'orders', action: 'order.status.change', severity: 'high', targetType: 'order' },
    { method: 'POST', path: '/:id/delivery-confirmation', domain: 'orders', action: 'order.delivery.confirm', severity: 'high', targetType: 'order' },
    { method: 'POST', path: '/:id/comment', domain: 'orders', action: 'order.comment.create', severity: 'normal', targetType: 'order' },
    { method: 'DELETE', path: '/:id', domain: 'orders', action: 'order.delete', severity: 'critical', targetType: 'order' },
]);
const ADMIN_EDITABLE_FIELDS = ['status', 'name', 'brand', 'category', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline', 'quantity', 'lines'];
const STRUCTURAL_EDITABLE_STATUSES = new Set(['pending', 'rejected', 'void']);
const QUANTITY_EDITABLE_STATUSES = new Set(['pending', 'confirmed', 'rejected', 'void']);
const ORDER_BOUND_SNAPSHOT_FIELDS = Object.freeze(['name', 'brand', 'category', 'series', 'sku', 'size', 'color', 'material']);

function normalizeLineText(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
}

function normalizeLineQuantity(value, fallback = 1) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return Math.trunc(parsed);
}

function normalizeEditableLines(lines = []) {
    return lines.map((line) => ({
        name: normalizeLineText(line.name ?? line.productName),
        brand: normalizeLineText(line.brand),
        category: normalizeLineText(line.category),
        series: normalizeLineText(line.series),
        sku: normalizeLineText(line.sku),
        size: normalizeLineText(line.size),
        color: normalizeLineText(line.color),
        material: normalizeLineText(line.material),
        remark: normalizeLineText(line.remark),
        deadline: normalizeLineText(line.deadline),
        quantity: normalizeLineQuantity(line.quantity ?? line.orderedQuantity),
        productId: line.productId ?? null,
        variantId: line.variantId ?? null,
    }));
}

async function hydrateEditableLines(db, lines = []) {
    const hydratedLines = [];
    for (const line of normalizeEditableLines(lines)) {
        const binding = await validateProductVariantBinding(
            db,
            line.productId || null,
            line.variantId ?? null,
            { checkActive: true }
        );
        const boundSnapshot = buildOrderBindingSnapshot({
            product: binding.product,
            variant: binding.variant,
            fallback: line,
        });
        hydratedLines.push({
            ...line,
            name: boundSnapshot.name,
            brand: boundSnapshot.brand,
            category: boundSnapshot.category,
            series: boundSnapshot.series,
            sku: boundSnapshot.sku,
            size: boundSnapshot.size,
            color: boundSnapshot.color,
            material: boundSnapshot.material,
            productId: binding.normalizedProductId,
            variantId: binding.normalizedVariantId,
        });
    }
    return hydratedLines;
}

function getAdminActor(user) {
    return {
        id: user?.id || 'admin',
        name: user?.name || 'Admin',
    };
}

async function assertStatusTransitionAllowed({ c, user, fromStatus, toStatus, forceStatusTransition, reason }) {
    if (toStatus === undefined || toStatus === fromStatus) return;
    if (canTransitionOrderStatus(fromStatus, toStatus)) return;
    if (!forceStatusTransition) {
        throw new BadRequestError(`Invalid status transition: ${fromStatus} -> ${toStatus}`);
    }
    await assertForceStatusTransitionAllowed(c, user, reason);
}

function scheduleOutboxProcessing(c, workerId) {
    c.executionCtx.waitUntil(runOutboxPoller({
        env: c.env,
        requestUrl: c.req.url,
        workerId,
    }));
}

/**
 * GET /:id - 获取订单详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new OrderRepository(env.DB);
    const order = await requireEntity(
        repo.findById(id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );

    // SOTA: 获取关联的文件和时间轴
    const { OrderTimelineRepository } = await import('../../../../../repositories/OrderTimelineRepository.js');
    const timelineRepo = new OrderTimelineRepository(env.DB);

    const [files, timeline, shipments, returns] = await Promise.all([
        repo.getFiles(id),
        timelineRepo.getTimeline(id),
        listOrderShipmentHistory(env.DB, id),
        listOrderReturnHistory(env.DB, id),
    ]);

    // 标记管理员已读
    await repo.markAsRead(id, 'admin');
    await publishSingleDomainEventAndPoll(c, {
        event_type: 'order_read_by_admin',
        aggregate_type: 'order',
        aggregate_id: id,
        payload: {
            order_id: id,
            salesperson_id: order.salespersonId || null,
        },
    }, `order-read-admin:${id}`);

    return c.json({
        success: true,
        data: {
            ...order,
            files,
            timeline,
            shipments,
            returns,
        }
    });
});

/**
 * PATCH /:id - 修改订单
 */
app.patch('/:id', zValidator('json', UpdateAdminOrderSchema), async (c) => {
    const { env } = c;
    const user = c.get('user'); // 从 JWT 获取管理员信息
    const actor = getAdminActor(user);
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireEntity(
        orderRepo.findById(id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );

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
    const rawLines = Array.isArray(updates.lines) ? updates.lines.filter(Boolean) : null;
    let normalizedLines = null;
    let payloadProductId = productId;
    let payloadVariantId = variantId;

    if (rawLines) {
        if (rawLines.length === 0) {
            throw new BadRequestError('lines must include at least one item');
        }
        normalizedLines = await hydrateEditableLines(env.DB, rawLines);
        const primaryLine = normalizedLines[0];
        const totalQuantity = normalizedLines.reduce((sum, line) => sum + line.quantity, 0);
        finalUpdates = {
            ...finalUpdates,
            name: primaryLine.name,
            brand: primaryLine.brand,
            category: primaryLine.category,
            series: primaryLine.series,
            sku: primaryLine.sku,
            size: primaryLine.size,
            color: primaryLine.color,
            material: primaryLine.material,
            remark: primaryLine.remark || finalUpdates.remark || '',
            deadline: primaryLine.deadline || finalUpdates.deadline || '',
            quantity: totalQuantity,
            lines: normalizedLines,
        };

        if (normalizedLines.length === 1) {
            if (payloadProductId === undefined) payloadProductId = primaryLine.productId ?? null;
            if (payloadVariantId === undefined) payloadVariantId = primaryLine.variantId ?? null;
        } else if (normalizedLines.length > 1) {
            if (payloadProductId === undefined) payloadProductId = null;
            if (payloadVariantId === undefined) payloadVariantId = null;
        }
    }

    const hasProductIdPayload = payloadProductId !== undefined;
    const hasVariantIdPayload = payloadVariantId !== undefined;
    const hasBindingMutation = hasProductIdPayload || hasVariantIdPayload;
    const hasQuantityMutation = updates.quantity !== undefined;
    const hasLineMutation = Boolean(normalizedLines);
    const effectiveProductId = hasProductIdPayload ? payloadProductId : order.productId;
    const hasExistingBinding = Boolean(order.productId && order.variantId);
    let normalizedVariantId = hasVariantIdPayload ? (payloadVariantId || null) : undefined;
    let validatedBinding = null;

    if (hasBindingMutation && !STRUCTURAL_EDITABLE_STATUSES.has(String(order.status || '').trim().toLowerCase())) {
        throw new BadRequestError('product binding can only be changed while order is pending, rejected, or void');
    }
    if (hasLineMutation && !STRUCTURAL_EDITABLE_STATUSES.has(String(order.status || '').trim().toLowerCase())) {
        throw new BadRequestError('order lines can only be changed while order is pending, rejected, or void');
    }
    if (hasQuantityMutation && !QUANTITY_EDITABLE_STATUSES.has(String(order.status || '').trim().toLowerCase())) {
        throw new BadRequestError('quantity can only be changed while order is pending, confirmed, rejected, or void');
    }

    if (hasExistingBinding && !hasBindingMutation) {
        for (const field of ORDER_BOUND_SNAPSHOT_FIELDS) {
            delete finalUpdates[field];
        }
    }

    if (hasBindingMutation) {
        validatedBinding = await validateProductVariantBinding(env.DB, effectiveProductId, normalizedVariantId, { checkActive: true });
        normalizedVariantId = validatedBinding.normalizedVariantId;
        const boundSnapshot = buildOrderBindingSnapshot({
            product: validatedBinding.product,
            variant: validatedBinding.variant,
            fallback: finalUpdates,
        });
        finalUpdates.name = boundSnapshot.name;
        finalUpdates.brand = boundSnapshot.brand;
        finalUpdates.category = boundSnapshot.category;
        finalUpdates.series = boundSnapshot.series;
        finalUpdates.sku = boundSnapshot.sku;
        finalUpdates.size = boundSnapshot.size;
        finalUpdates.color = boundSnapshot.color;
        finalUpdates.material = boundSnapshot.material;
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

    const updateResult = await processOrderUpdate({
        env,
        orderId: id,
        orderNo: order.orderNo,
        currentData: order.currentData,
        currentStatus: order.status,
        updates: finalUpdates,
        fileIds,
        productId: payloadProductId,
        variantId: normalizedVariantId,
        currentProductId: order.productId,
        currentVariantId: order.variantId,
        currentSalespersonId: order.salespersonId,
        allowedFields: ADMIN_EDITABLE_FIELDS,
        actor: { type: 'admin', id: actor.id, name: actor.name },
        reason: reason || 'Admin Update',
        salespersonId: updates.salespersonId ?? order.salespersonId, // 传入销售员ID以发送通知
        salespersonIdUpdate: updates.salespersonId,
        forceStatusTransition,
        deferNotifications: true,
    });

    if (updateResult?.outboxEvents?.length) {
        const publisher = new DomainOutboxPublisher(env.DB);
        await publisher.publish(updateResult.outboxEvents);
        scheduleOutboxProcessing(c, `order-update:${id}`);
    }

    let updatedOrder = null;
    const nextStatus = finalUpdates?.status ?? order.status;
    const nextVariantId = hasVariantIdPayload ? normalizedVariantId : order.variantId;
    const nextQuantity = finalUpdates?.quantity ?? order.quantity;
    const demandService = new DemandService(env.DB);
    const hasMultiLineDemandContext =
        (Array.isArray(order.lines) && order.lines.length > 1) ||
        (Array.isArray(normalizedLines) && normalizedLines.length > 1);
    if (hasMultiLineDemandContext) {
        updatedOrder = await orderRepo.findById(id);
        const persistedNextLines =
            Array.isArray(updatedOrder?.lines) && updatedOrder.lines.length > 0
                ? updatedOrder.lines
                : (normalizedLines || order.lines || []);
        const persistedNextStatus = updatedOrder?.status ?? nextStatus;
        const persistedNextProductId = updatedOrder?.productId ?? (hasProductIdPayload ? payloadProductId : order.productId);
        const persistedNextVariantId = updatedOrder?.variantId ?? nextVariantId;
        const persistedNextQuantity = updatedOrder?.quantity ?? nextQuantity;
        await syncOrderDemandTransitionsByLines(demandService, {
            orderId: id,
            previousStatus: order.status,
            nextStatus: persistedNextStatus,
            previousLines: order.lines || [],
            nextLines: persistedNextLines,
            previousFallback: {
                productId: order.productId,
                variantId: order.variantId,
                quantity: order.quantity,
            },
            nextFallback: {
                productId: persistedNextProductId,
                variantId: persistedNextVariantId,
                quantity: persistedNextQuantity,
            },
        });
    } else {
        await syncOrderDemandTransitions(demandService, {
            orderId: id,
            previousStatus: order.status,
            nextStatus,
            previousQuantity: order.quantity,
            nextQuantity,
            previousVariantId: order.variantId,
            nextVariantId,
        });
    }

    updatedOrder = updatedOrder || await orderRepo.findById(id);
    scheduleAuditEvent(c, {
        domain: 'orders',
        action: 'order.update',
        result: 'success',
        severity: forceStatusTransition ? 'high' : 'normal',
        targetType: 'order',
        targetId: id,
        target_label: order.orderNo,
        summary: `${actor.name} updated order ${order.orderNo}`,
        changes_json: { before: { status: order.status }, after: { status: updatedOrder?.status ?? nextStatus } },
        metadata: { reason: reason || 'Admin Update', force: forceStatusTransition },
    });
    return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS, data: updatedOrder });
});

/**
 * PATCH /:id/status - 更新订单状态
 */
app.patch('/:id/status', zValidator('json', UpdateOrderStatusSchema), async (c) => {
    const { env } = c;
    const user = c.get('user');
    const actor = getAdminActor(user);
    const id = c.req.param('id');
    const { status, note, force } = c.req.valid('json');
    if (!ORDER_STATUSES.includes(status)) {
        throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
    }

    const repo = new OrderRepository(env.DB);
    const order = await requireEntity(
        repo.findById(id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );

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
        const demandService = new DemandService(env.DB);
        if (Array.isArray(order.lines) && order.lines.length > 1) {
            await syncOrderDemandTransitionsByLines(demandService, {
                orderId: id,
                previousStatus: oldStatus,
                nextStatus: status,
                previousLines: order.lines,
                nextLines: order.lines,
                previousFallback: {
                    productId: order.productId,
                    variantId: order.variantId,
                    quantity: order.quantity,
                },
                nextFallback: {
                    productId: order.productId,
                    variantId: order.variantId,
                    quantity: order.quantity,
                },
            });
        } else {
            await demandService.syncOrderTransition({
                orderId: id,
                fromStatus: oldStatus,
                toStatus: status,
                quantity: order.quantity,
                variantId: order.variantId,
            });
        }

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

        const publisher = new DomainOutboxPublisher(env.DB);
        await publisher.publish([
            {
                event_type: 'order_status_changed_by_admin',
                aggregate_type: 'order',
                aggregate_id: id,
                payload: {
                    order_id: id,
                    order_no: order.orderNo,
                    salesperson_id: order.salespersonId || null,
                    actor_name: actor.name,
                    status,
                    force: forceStatusTransition,
                },
            },
        ]);
        scheduleOutboxProcessing(c, `order-status:${id}:${status}`);
    } else {
        throw new BadRequestError(MSG.COMMON.OP_FAILED);
    }

    scheduleAuditEvent(c, {
        domain: 'orders',
        action: forceStatusTransition ? 'order.status.force_change' : 'order.status.change',
        result: 'success',
        severity: forceStatusTransition ? 'high' : 'normal',
        targetType: 'order',
        targetId: id,
        target_label: order.orderNo,
        summary: `${actor.name} changed order ${order.orderNo} status to ${status}`,
        changes_json: { before: { status: oldStatus }, after: { status } },
        metadata: { force: forceStatusTransition, note: note || '' },
    });
    return c.json({ success: true, message: MSG.ORDER.STATUS_CHANGED });
});

app.post('/:id/delivery-confirmation', zValidator('json', DeliveryConfirmationSchema), async (c) => {
    const { env } = c;
    const user = c.get('user');
    const actor = getAdminActor(user);
    const id = c.req.param('id');
    const { note = '' } = c.req.valid('json');

    const repo = new OrderRepository(env.DB);
    const beforeOrder = await requireEntity(
        repo.findById(id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );

    const service = new OrderDeliveryService(env.DB);
    const result = await service.confirmDelivery(id, { note }, {
        actorId: actor.id,
        actorName: actor.name,
    });

    await repo.timelineRepo.addTimelineEntry(id, {
        actionType: 'field_updated',
        actorType: 'admin',
        actorId: actor.id,
        actorName: actor.name,
        fieldName: 'delivery_status',
        oldValue: beforeOrder.deliveryStatus || 'in_transit',
        newValue: 'delivered',
        reason: String(note || '').trim(),
    });

    scheduleAuditEvent(c, {
        domain: 'orders',
        action: 'order.delivery.confirm',
        result: 'success',
        severity: 'high',
        targetType: 'order',
        targetId: id,
        target_label: beforeOrder.orderNo,
        summary: `${actor.name} confirmed delivery for order ${beforeOrder.orderNo}`,
        changes_json: {
            before: { deliveryStatus: beforeOrder.deliveryStatus || 'in_transit' },
            after: { deliveryStatus: 'delivered' },
        },
        metadata: {
            note: String(note || '').trim(),
            deliveredAt: result.deliveredAt,
        },
    });

    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish([
        {
            event_type: 'order_delivery_confirmed',
            aggregate_type: 'order',
            aggregate_id: id,
            payload: {
                order_id: id,
                order_no: beforeOrder.orderNo,
                salesperson_id: beforeOrder.salespersonId || null,
                actor_name: actor.name,
                delivery_status: 'delivered',
                delivered_at: result.deliveredAt,
            },
        },
    ]);
    scheduleOutboxProcessing(c, `order-delivery-confirm:${id}`);

    const updatedOrder = await repo.findById(id);
    return c.json({
        success: true,
        message: 'Delivery confirmed',
        data: updatedOrder,
    });
});

/**
 * POST /:id/comment - 添加订单备注/留言
 */
app.post('/:id/comment', zValidator('json', AddOrderCommentSchema), async (c) => {
    const { env } = c;
    const user = c.get('user');
    const actor = getAdminActor(user);
    const id = c.req.param('id');
    // SOTA: Payload key mismatch fix (frontend sends 'comment', backend expected 'content')
    const { comment } = c.req.valid('json');

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

    const order = await repo.findById(id);
    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish([
        {
            event_type: 'order_comment_created_by_admin',
            aggregate_type: 'order',
            aggregate_id: id,
            payload: {
                order_id: id,
                order_no: order?.orderNo || id,
                salesperson_id: order?.salespersonId || null,
                actor_name: actor.name,
                comment,
            },
        },
    ]);
    scheduleOutboxProcessing(c, `order-comment:${id}`);
    scheduleAuditEvent(c, {
        domain: 'orders',
        action: 'order.comment.create',
        result: 'success',
        severity: 'normal',
        targetType: 'order',
        targetId: id,
        target_label: order?.orderNo || id,
        summary: `${actor.name} added a comment to order ${order?.orderNo || id}`,
        metadata: { comment },
    });
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
    await orderRepo.deleteOrderCascading(id);
    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish([
        {
            event_type: 'order_deleted_by_admin',
            aggregate_type: 'order',
            aggregate_id: id,
            payload: {
                order_id: id,
                order_no: order?.orderNo || id,
                salesperson_id: order?.salespersonId || null,
                actor_name: user?.name || 'Admin',
            },
        },
    ]);
    scheduleOutboxProcessing(c, `order-delete:${id}`);
    scheduleAuditEvent(c, {
        domain: 'orders',
        action: 'order.delete',
        result: 'success',
        severity: 'critical',
        targetType: 'order',
        targetId: id,
        target_label: order?.orderNo || id,
        summary: `${user?.name || 'Admin'} deleted order ${order?.orderNo || id}`,
        metadata: { salespersonId: order?.salespersonId || null },
    });

    return c.json({ success: true, message: MSG.ORDER.DELETE_SUCCESS });
});

export default app;
