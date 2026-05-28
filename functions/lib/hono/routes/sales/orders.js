import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateOrderSchema, AddCommentSchema, UpdateSalesOrderSchema } from '../../schemas/sales.js';
import { MSG, generateId, generateOrderNo } from '../../../../_shared/utils.js';
import { normalizeOrderStatusFilter } from '../../../../api/utils/constants.js';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';
import { validateProductVariantBinding } from '../../../../api/utils/validation.js';
import { parsePagination, requireEntity } from '../../_shared/route-helpers.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../errors.js';
import { withCache } from '../../middleware/cache.js';
import { DemandService } from '../../../../services/DemandService.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { DomainOutboxPublisher } from '../../../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from '../../../../api/cron/outbox.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';
import { listOrderReturnHistory, listOrderShipmentHistory } from '../../../../repositories/order/history-queries.js';
import { syncOrderDemandTransitions } from '../../../../api/utils/order-demand-sync.js';
import { buildOrderBindingSnapshot } from '../../../../api/utils/order-binding-snapshot.js';

const app = new Hono();
const SALES_BOUND_SNAPSHOT_FIELDS = Object.freeze(['name', 'brand', 'category', 'series', 'sku', 'size', 'color', 'material']);
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'sales-orders', action: 'sales.order.create', severity: 'high', targetType: 'order' },
    { method: 'PATCH', path: '/:id/read', domain: 'sales-orders', action: 'sales.order.read', severity: 'normal', targetType: 'order' },
    { method: 'PATCH', path: '/:id', domain: 'sales-orders', action: 'sales.order.update', severity: 'high', targetType: 'order' },
    { method: 'DELETE', path: '/:id', domain: 'sales-orders', action: 'sales.order.void', severity: 'high', targetType: 'order' },
    { method: 'POST', path: '/:id/comment', domain: 'sales-orders', action: 'sales.order.comment.create', severity: 'normal', targetType: 'order' },
]);

app.onError((err, c) => {
    const statusCode = Number(err?.statusCode || 500);
    const code = err?.code || 'INTERNAL_ERROR';
    const error = err?.message || 'Internal Server Error';
    return c.json({ success: false, error, code }, statusCode);
});

function scheduleOutboxProcessing(c, workerId) {
    c.executionCtx.waitUntil(runOutboxPoller({
        env: c.env,
        requestUrl: c.req.url,
        workerId,
    }));
}

/**
 * GET / - 获取订单列表
 */
app.get('/', withCache(20), async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;
    const { page, limit } = parsePagination(c);
    const status = c.req.query('status');
    const search = c.req.query('search') || '';

    const orderRepo = new OrderRepository(env.DB);
    const result = await orderRepo.listBySalesperson(salesperson.id, {
        status: normalizeOrderStatusFilter(status),
        search: search.trim(),
        page,
        limit
    });

    return c.json({
        success: true,
        data: result.items,
        pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
        },
    });
});

/**
 * POST / - 创建订单
 */
app.post('/', zValidator('json', CreateOrderSchema), async (c) => {
    const salesperson = c.get('salesperson');
    const data = c.req.valid('json');
    const { env } = c;
    const orderRepo = new OrderRepository(env.DB);

    const orderId = generateId();
    const orderNo = generateOrderNo();
    const normalizedLines = Array.isArray(data.lines) ? data.lines.filter(Boolean).map((line) => ({
        name: String(line.name || '').trim(),
        brand: String(line.brand || '').trim(),
        category: String(line.category || '').trim(),
        series: String(line.series || '').trim(),
        sku: String(line.sku || '').trim(),
        size: String(line.size || '').trim(),
        color: String(line.color || '').trim(),
        material: String(line.material || '').trim(),
        remark: String(line.remark || '').trim(),
        deadline: String(line.deadline || '').trim(),
        quantity: Math.max(1, Math.trunc(Number(line.quantity || 1))),
        productId: line.productId || null,
        variantId: line.variantId ?? null,
    })) : [];
    const primaryLine = normalizedLines[0] || null;
    const variantId = primaryLine ? (primaryLine.variantId ?? null) : (data.variantId ?? null);

    const binding = await validateProductVariantBinding(env.DB, primaryLine ? (primaryLine.productId || null) : (data.productId || null), variantId, {
        checkActive: true,
        variantSelectPolicy: 'in_stock_only',
    });
    const boundSnapshot = buildOrderBindingSnapshot({
        product: binding.product,
        variant: binding.variant,
        fallback: primaryLine || {
            name: data.name,
            brand: data.brand,
            series: data.series,
            sku: data.sku,
            size: data.size,
            color: data.color,
            material: data.material,
        },
    });
    const totalQuantity = normalizedLines.length > 0
        ? normalizedLines.reduce((sum, line) => sum + line.quantity, 0)
        : data.quantity;

    // 1. 创建订单（事务）
    const createdOrder = await orderRepo.create({
        id: orderId,
        orderNo,
        salespersonId: salesperson.id,
        enforceSalesFileScope: true,
        data: {
            name: boundSnapshot.name,
            size: boundSnapshot.size,
            color: boundSnapshot.color,
            material: boundSnapshot.material,
            remark: data.remark,
            deadline: data.deadline,
            brand: boundSnapshot.brand,
            category: boundSnapshot.category,
            series: boundSnapshot.series,
            sku: boundSnapshot.sku,
        },
        quantity: totalQuantity,
        mainImageId: data.fileIds[0] || null,
        fileIds: data.fileIds,
        productId: normalizedLines.length === 1 ? (primaryLine?.productId || data.productId || null) : (data.productId || null),
        variantId: normalizedLines.length === 1 ? variantId : null,
        lines: normalizedLines,
        timeline: {
            actionType: 'created',
            actorType: 'salesperson',
            actorId: salesperson.id,
            actorName: salesperson.name,
        },
    });
    const persistedOrderId = createdOrder?.id || orderId;
    const persistedOrderNo = createdOrder?.orderNo || orderNo;

    const demandService = new DemandService(env.DB);
    await demandService.syncOrderTransition({
        orderId: persistedOrderId,
        fromStatus: null,
        toStatus: 'pending',
        quantity: totalQuantity,
        variantId: normalizedLines.length === 1 ? variantId : null,
    });

    // 创建订单后将临时上传文件归档到订单目录，避免文件滞留在根目录
    const fileIds = Array.isArray(data.fileIds) ? data.fileIds.filter(Boolean) : [];
    if (fileIds.length > 0) {
        try {
            const { ensureOrderFolder, moveFilesToFolder } = await import('../../../../api/utils/folder-utils.js');
            const orderFolderId = await ensureOrderFolder(env, persistedOrderNo);
            await moveFilesToFolder(env, fileIds, orderFolderId);
        } catch (error) {
            console.error('Order file archiving error (sales create):', error);
        }
    }

    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish([
        {
            event_type: 'order_created_by_sales',
            aggregate_type: 'order',
            aggregate_id: persistedOrderId,
            payload: {
                order_id: persistedOrderId,
                order_no: persistedOrderNo,
                salesperson_id: salesperson.id,
                actor_name: salesperson.name,
            },
        },
    ]);
    scheduleOutboxProcessing(c, `sales-order-create:${persistedOrderId}`);
    scheduleAuditEvent(c, {
        domain: 'sales-orders',
        action: 'sales.order.create',
        result: 'success',
        severity: 'high',
        targetType: 'order',
        targetId: persistedOrderId,
        target_label: persistedOrderNo,
        summary: `${salesperson.name} created order ${persistedOrderNo}`,
        metadata: { salespersonId: salesperson.id, productId: data.productId || null, variantId },
    });

    return c.json({ success: true, data: { id: persistedOrderId, orderNo: persistedOrderNo } }, 201);
});

/**
 * GET /:id - 获取订单详情
 */
app.get('/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireEntity(
        orderRepo.findByIdAndSalesperson(orderId, salesperson.id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );

    const { OrderTimelineRepository } = await import('../../../../repositories/OrderTimelineRepository.js');
    const tplRepo = new OrderTimelineRepository(env.DB);

    const [files, timeline, shipments, returns] = await Promise.all([
        orderRepo.getFiles(orderId),
        tplRepo.getTimeline(orderId),
        listOrderShipmentHistory(env.DB, orderId),
        listOrderReturnHistory(env.DB, orderId),
    ]);

    // Mark as read
    await orderRepo.markAsRead(orderId, 'sales');
    await publishSingleDomainEventAndPoll(c, {
        event_type: 'order_read_by_sales',
        aggregate_type: 'order',
        aggregate_id: orderId,
        payload: {
            order_id: orderId,
            salesperson_id: salesperson.id,
        },
    }, `order-read-sales:${orderId}`);

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
 * PATCH /:id/read - 标记订单已读
 */
app.patch('/:id/read', async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    await requireEntity(
        orderRepo.findByIdAndSalesperson(orderId, salesperson.id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );
    await orderRepo.markAsRead(orderId, 'sales');
    await publishSingleDomainEventAndPoll(c, {
        event_type: 'order_read_by_sales',
        aggregate_type: 'order',
        aggregate_id: orderId,
        payload: {
            order_id: orderId,
            salesperson_id: salesperson.id,
        },
    }, `order-read-sales:${orderId}`);
    scheduleAuditEvent(c, {
        domain: 'sales-orders',
        action: 'sales.order.read',
        result: 'success',
        severity: 'normal',
        targetType: 'order',
        targetId: orderId,
        target_label: orderId,
        summary: `${salesperson.name} marked order ${orderId} as read`,
    });

    return c.json({ success: true, message: MSG.ORDER.ALREADY_READ });
});

/**
 * PATCH /:id - 修改订单
 */
app.patch('/:id', zValidator('json', UpdateSalesOrderSchema), async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const body = c.req.valid('json');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireEntity(
        orderRepo.findByIdAndSalesperson(orderId, salesperson.id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );

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

    if (Object.prototype.hasOwnProperty.call(updates, 'lines')) {
        throw new BadRequestError('销售端暂不支持多商品明细');
    }

    const { processOrderUpdate } = await import('../../../../api/utils/order-utils.js');

    const hasProductIdPayload = productId !== undefined;
    const hasVariantIdPayload = variantId !== undefined;
    const hasBindingMutation = hasProductIdPayload || hasVariantIdPayload;
    const effectiveProductId = hasProductIdPayload ? productId : order.productId;
    const hasExistingBinding = Boolean(order.productId && order.variantId);
    let normalizedVariantId = hasVariantIdPayload ? (variantId || null) : undefined;
    const finalUpdates = { ...updates };

    if (hasExistingBinding && !hasBindingMutation) {
        for (const field of SALES_BOUND_SNAPSHOT_FIELDS) {
            delete finalUpdates[field];
        }
    }

    if (hasBindingMutation) {
        const binding = await validateProductVariantBinding(env.DB, effectiveProductId, normalizedVariantId, {
            checkActive: true,
            variantSelectPolicy: 'in_stock_only',
        });
        normalizedVariantId = binding.normalizedVariantId;
        const boundSnapshot = buildOrderBindingSnapshot({
            product: binding.product,
            variant: binding.variant,
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

    // 销售端允许修改的字段
    // SOTA: productId 是顶级表列，通过 options.productId 单独传递处理，不应加入 JSON data 字段列表
    const SALES_EDITABLE_FIELDS = ['name', 'brand', 'category', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline', 'quantity'];

    const updateResult = await processOrderUpdate({
        env,
        orderId,
        orderNo: order.orderNo,
        currentData: order.currentData,
        currentStatus: order.status,
        updates: finalUpdates,
        fileIds,
        productId,
        variantId: normalizedVariantId,
        currentProductId: order.productId,
        currentVariantId: order.variantId,
        allowedFields: SALES_EDITABLE_FIELDS,
        actor: { type: 'salesperson', id: salesperson.id, name: salesperson.name },
        salespersonId: salesperson.id,
        enforceSalesFileScope: true,
        reason: reason.trim(),
        deferNotifications: true,
    });

    if (updateResult?.outboxEvents?.length) {
        const publisher = new DomainOutboxPublisher(env.DB);
        await publisher.publish(updateResult.outboxEvents);
        scheduleOutboxProcessing(c, `sales-order-update:${orderId}`);
    }

    const nextStatus = ['rejected', 'void'].includes(order.status)
        ? 'pending'
        : (finalUpdates?.status ?? order.status);
    const nextVariantId = hasVariantIdPayload ? normalizedVariantId : order.variantId;
    const nextQuantity = finalUpdates?.quantity ?? order.quantity;
    const demandService = new DemandService(env.DB);
    await syncOrderDemandTransitions(demandService, {
        orderId,
        previousStatus: order.status,
        nextStatus,
        previousQuantity: order.quantity,
        nextQuantity,
        previousVariantId: order.variantId,
        nextVariantId,
    });

    if (['rejected', 'void'].includes(order.status)) {
        await orderRepo.updateStatus(orderId, 'pending', 'sales');
    }

    scheduleAuditEvent(c, {
        domain: 'sales-orders',
        action: 'sales.order.update',
        result: 'success',
        severity: 'high',
        targetType: 'order',
        targetId: orderId,
        target_label: order.orderNo,
        summary: `${salesperson.name} updated order ${order.orderNo}`,
        metadata: { reason: reason.trim(), productId: productId || null, variantId: normalizedVariantId ?? order.variantId },
    });

    return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS });
});

/**
 * DELETE /:id - 作废订单
 */
app.delete('/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await requireEntity(
        orderRepo.findByIdAndSalesperson(orderId, salesperson.id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );
    if (order.status !== 'pending') throw new ForbiddenError(MSG.ORDER.ONLY_PENDING_CAN_VOID);

    await orderRepo.updateStatus(orderId, 'void', 'sales');

    const demandService = new DemandService(env.DB);
    await demandService.syncOrderTransition({
        orderId,
        fromStatus: order.status,
        toStatus: 'void',
        quantity: order.quantity,
        variantId: order.variantId,
    });

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

    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish([
        {
            event_type: 'order_status_changed_by_sales',
            aggregate_type: 'order',
            aggregate_id: orderId,
            payload: {
                order_id: orderId,
                order_no: order.orderNo,
                salesperson_id: salesperson.id,
                actor_name: salesperson.name,
                status: 'void',
            },
        },
    ]);
    scheduleOutboxProcessing(c, `sales-order-status:${orderId}:void`);
    scheduleAuditEvent(c, {
        domain: 'sales-orders',
        action: 'sales.order.void',
        result: 'success',
        severity: 'high',
        targetType: 'order',
        targetId: orderId,
        target_label: order.orderNo,
        summary: `${salesperson.name} voided order ${order.orderNo}`,
        changes_json: { before: { status: order.status }, after: { status: 'void' } },
    });

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
    const order = await requireEntity(
        orderRepo.findByIdAndSalesperson(orderId, salesperson.id),
        () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );

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

    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish([
        {
            event_type: 'order_comment_created_by_sales',
            aggregate_type: 'order',
            aggregate_id: orderId,
            payload: {
                order_id: orderId,
                order_no: order.orderNo,
                salesperson_id: salesperson.id,
                actor_name: salesperson.name,
                comment: comment.trim(),
            },
        },
    ]);
    scheduleOutboxProcessing(c, `sales-order-comment:${orderId}`);
    scheduleAuditEvent(c, {
        domain: 'sales-orders',
        action: 'sales.order.comment.create',
        result: 'success',
        severity: 'normal',
        targetType: 'order',
        targetId: orderId,
        target_label: order.orderNo,
        summary: `${salesperson.name} commented on order ${order.orderNo}`,
        metadata: { comment: comment.trim() },
    });
    return c.json({ success: true, message: MSG.ORDER.COMMENT_ADDED });
});

export default app;
