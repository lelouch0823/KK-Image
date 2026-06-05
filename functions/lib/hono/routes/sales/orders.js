import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateOrderSchema, AddCommentSchema, UpdateSalesOrderSchema } from '../../schemas/sales.js';
import { MSG, generateId, generateOrderNo } from '../../../../_shared/utils.js';
import { normalizeOrderStatusFilter } from '../../../../api/utils/constants.js';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';
import { parsePagination, requireEntity } from '../../_shared/route-helpers.js';
import { NotFoundError, ForbiddenError } from '../../errors.js';
import { withCache } from '../../middleware/cache.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { runOutboxPoller } from '../../../../api/cron/outbox.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';
import { listOrderReturnHistory, listOrderShipmentHistory } from '../../../../repositories/order/history-queries.js';
import { processOrderUpdate } from '../../../../api/utils/order-utils.js';
import { OrderTimelineRepository } from '../../../../repositories/OrderTimelineRepository.js';
import { OrderCreationService } from '../../../../services/OrderCreationService.js';

const app = new Hono();

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
    const service = new OrderCreationService(env.DB);

    const orderId = generateId();
    const orderNo = generateOrderNo();

    // 业务逻辑：规范化 + 绑定验证 + 快照构建
    const { normalizedLines, bindingSnapshot, totalQuantity, effectiveVariantId } =
        await service.prepareCreateOrder(salesperson, data);
    const primaryLine = normalizedLines[0] || null;

    // 1. 创建订单（事务）
    const createdOrder = await orderRepo.create({
        id: orderId,
        orderNo,
        salespersonId: salesperson.id,
        enforceSalesFileScope: true,
        data: {
            name: bindingSnapshot.name,
            size: bindingSnapshot.size,
            color: bindingSnapshot.color,
            material: bindingSnapshot.material,
            remark: data.remark,
            deadline: data.deadline,
            brand: bindingSnapshot.brand,
            category: bindingSnapshot.category,
            series: bindingSnapshot.series,
            sku: bindingSnapshot.sku,
        },
        quantity: totalQuantity,
        mainImageId: data.fileIds[0] || null,
        fileIds: data.fileIds,
        productId: normalizedLines.length === 1 ? (primaryLine?.productId || data.productId || null) : (data.productId || null),
        variantId: normalizedLines.length === 1 ? effectiveVariantId : null,
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

    // 2. 需求同步
    await service.syncDemand(persistedOrderId, 'pending', totalQuantity, normalizedLines.length === 1 ? effectiveVariantId : null);

    // 3. 文件归档
    await service.archiveFiles(env, data.fileIds, persistedOrderNo);

    // 4. 发布领域事件
    await service.publishEvents([
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
        metadata: { salespersonId: salesperson.id, productId: data.productId || null, variantId: effectiveVariantId },
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

    const service = new OrderCreationService(env.DB);

    // 业务逻辑：字段过滤 + 绑定验证 + 快照构建
    const { finalUpdates, normalizedVariantId, reason, fileIds, productId } =
        await service.prepareUpdateOrder(order, body);

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
        allowedFields: service.getSalesEditableFields(),
        actor: { type: 'salesperson', id: salesperson.id, name: salesperson.name },
        salespersonId: salesperson.id,
        enforceSalesFileScope: true,
        reason,
        deferNotifications: true,
    });

    if (updateResult?.outboxEvents?.length) {
        await service.publishEvents(updateResult.outboxEvents);
        scheduleOutboxProcessing(c, `sales-order-update:${orderId}`);
    }

    // 需求同步
    const nextStatus = ['rejected', 'void'].includes(order.status)
        ? 'pending'
        : (finalUpdates?.status ?? order.status);
    const nextVariantId = normalizedVariantId !== undefined ? normalizedVariantId : order.variantId;
    const nextQuantity = finalUpdates?.quantity ?? order.quantity;
    await service.syncDemandTransitions({
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
        metadata: { reason, productId: productId || null, variantId: normalizedVariantId ?? order.variantId },
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

    const service = new OrderCreationService(env.DB);
    await service.syncDemand(orderId, 'void', order.quantity, order.variantId);

    // SOTA: 记录时间轴
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

    await service.publishEvents([
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

    const tplRepo = new OrderTimelineRepository(env.DB);

    await tplRepo.addTimelineEntry(orderId, {
        actionType: 'comment',
        actorType: 'salesperson',
        actorId: salesperson.id,
        actorName: salesperson.name,
        comment: comment.trim(),
    });

    await orderRepo.setUnread(orderId, 'sales');

    const service = new OrderCreationService(env.DB);
    await service.publishEvents([
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
