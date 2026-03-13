
import { Hono } from 'hono';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import {
    canTransitionOrderStatus
} from '../../../../../api/utils/order-state-machine.js';
import { MSG, ORDER_STATUSES } from '../../../_shared/utils.js';
import { BadRequestError } from '../../../errors.js';
import { assertForceStatusTransitionAllowed } from './authz-helpers.js';
import {
    resolveSalesTokens,
    scheduleOrderMutationCachesInvalidation,
} from './cache-helpers.js';
import { isInsufficientStockError, isInvalidStatusTransitionError } from './error-helpers.js';
import { createManagedOrder } from './create-order.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'orders', action: 'order.create', severity: 'high', targetType: 'order', runtimeAssertionLevel: 'runtime', highRisk: true },
    { method: 'POST', path: '/batch', domain: 'orders', action: 'order.batch_update', severity: 'high', targetType: 'order', highRisk: true },
]);
const ACTION_STATUS_MAP = {
    confirm: 'confirmed',
    reject: 'rejected',
    void: 'void',
};

function normalizeBatchAction(action, value) {
    let normalizedAction = action;
    let normalizedStatus = value;
    if (action in ACTION_STATUS_MAP) {
        normalizedAction = 'status';
        normalizedStatus = ACTION_STATUS_MAP[action];
    }
    return { normalizedAction, normalizedStatus };
}

function assertValidBatchStatusAction(normalizedAction, normalizedStatus) {
    if (normalizedAction !== 'status' || !ORDER_STATUSES.includes(normalizedStatus)) {
        throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
    }
}

/**
 * POST / - 管理端创建订单
 */
app.post('/', async (c) => {
    const body = await c.req.json();
    const result = await createManagedOrder(c, body);
    scheduleAuditEvent(c, {
        domain: 'orders',
        action: 'order.create',
        result: 'success',
        severity: 'high',
        targetType: 'order',
        targetId: result?.id || null,
        target_label: result?.orderNo || result?.id || null,
        summary: `Created order ${result?.orderNo || result?.id || ''}`.trim(),
    });
    return c.json({ success: true, data: result }, 201);
});

/**
 * POST /batch - 批量操作接口
 */
app.post('/batch', async (c) => {
    const { env } = c;
    const user = c.get('user');
    const { ids, action, value, reason, force } = await c.req.json();
    const repo = new OrderRepository(env.DB);
    const actorName = user?.name || 'Admin';
    const normalizedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];

    if (normalizedIds.length === 0) {
        throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);
    }

    const { normalizedAction, normalizedStatus } = normalizeBatchAction(action, value);
    assertValidBatchStatusAction(normalizedAction, normalizedStatus);

    if (normalizedAction === 'status') {
        const forceStatusTransition = Boolean(force);
        const actionLabel = MSG.ORDER.ACTIONS?.[normalizedStatus] || normalizedStatus;
        const updateReason = reason || `${MSG.ORDER.ACTIONS.BATCH_PREFIX}${actionLabel}`;

        // 1. 先查询需要通知的订单信息
        const { results: orders } = await env.DB.prepare(
            `SELECT id, order_no, salesperson_id, status FROM orders WHERE id IN (${normalizedIds.map(() => '?').join(',')})`
        ).bind(...normalizedIds).all();
        const notificationSalesTokens = await resolveSalesTokens(env.DB, (orders || []).map((o) => o.salesperson_id));
        const outOfFlowOrder = (orders || []).find((o) => !canTransitionOrderStatus(o.status, normalizedStatus));
        if (outOfFlowOrder) {
            if (!forceStatusTransition) {
                throw new BadRequestError(`Invalid status transition in batch: ${outOfFlowOrder.status} -> ${normalizedStatus}`);
            }
            await assertForceStatusTransitionAllowed(c, user, reason);
        }

        // 2. 更新状态
        try {
            await repo.batchUpdateStatus(normalizedIds, normalizedStatus, {
                actorType: 'admin',
                actorName: actorName,
                reason: updateReason
            }, { forceStatusTransition });
        } catch (error) {
            if (isInsufficientStockError(error)) {
                throw new BadRequestError('Insufficient stock: cannot mark order as delivered');
            }
            if (isInvalidStatusTransitionError(error)) {
                throw new BadRequestError(`Invalid status transition in batch to ${normalizedStatus}`);
            }
            throw error;
        }

        // 3. SOTA: 发送批量通知给销售
        if (orders && orders.length > 0) {
            const notifications = orders.filter(o => o.salesperson_id).map(order => ({
                event: 'ORDER_BATCH_STATUS_CHANGED',
                orderId: order.id,
                orderNo: order.order_no,
                receiver: 'sales',
                salespersonId: order.salesperson_id,
                actorName: actorName,
                extra: { status: normalizedStatus, force: forceStatusTransition }
            }));

            if (notifications.length > 0) {
                const { createBatchOrderNotifications } = await import('../../../../../api/utils/order-utils.js');
                await createBatchOrderNotifications(env.DB, notifications);
            }
        }

        scheduleOrderMutationCachesInvalidation(c, { salesTokens: notificationSalesTokens });
    }
    scheduleAuditEvent(c, {
        domain: 'orders',
        action: 'order.batch_update',
        result: 'success',
        severity: 'high',
        targetType: 'order',
        summary: `Batch updated ${normalizedIds.length} orders`,
        metadata: { count: normalizedIds.length, action: normalizedAction, status: normalizedStatus, force: Boolean(force) },
    });

    return c.json({ success: true, message: MSG.ORDER.BATCH_RESULT.replace('{valid}', normalizedIds.length) });
});

export default app;
