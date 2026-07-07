import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateAdminOrderSchema, BatchCreateOrderSchema } from '../../../schemas/order.js';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { CommandIdempotencyRepository } from '../../../../../repositories/CommandIdempotencyRepository.js';
import { canTransitionOrderStatus } from '../../../../../api/utils/order-state-machine.js';
import { DemandService } from '../../../../../services/DemandService.js';
import { MSG, ORDER_STATUSES } from '../../../../../_shared/utils.js';
import { BadRequestError } from '../../../errors.js';
import { assertForceStatusTransitionAllowed } from './authz-helpers.js';
import { isInsufficientStockError, isInvalidStatusTransitionError } from './error-helpers.js';
import {
  completeManagedOrderCreateSideEffects,
  createManagedOrder,
  publishOrderCreatedByAdmin,
} from './create-order.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import { getIdempotencyKey } from '../../_shared/outbox-helpers.js';
import {
  cleanupReservedCommand,
  parseStoredResponse,
  replayReservedCommand,
  resolveReservationOwnership,
} from '../../../../../services/order-procurement-shared.js';
import {
  syncOrderDemandTransitions,
  syncOrderDemandTransitionsByLines,
} from '../../../../../api/utils/order-demand-sync.js';

const app = new Hono();
const ORDER_CREATE_COMMAND_TYPE = 'order_create';
export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/',
    domain: 'orders',
    action: 'order.create',
    severity: 'high',
    targetType: 'order',
    runtimeAssertionLevel: 'runtime',
    highRisk: true,
  },
  {
    method: 'POST',
    path: '/batch',
    domain: 'orders',
    action: 'order.batch_update',
    severity: 'high',
    targetType: 'order',
    highRisk: true,
  },
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

function normalizeOrderCreateFingerprintValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeOrderCreateFingerprintValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const normalized = normalizeOrderCreateFingerprintValue(value[key]);
        if (normalized !== undefined) {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }

  return value;
}

function buildOrderCreateRequestFingerprint(body = {}) {
  return JSON.stringify(normalizeOrderCreateFingerprintValue(body));
}

function getCreateCommandScopeKey(c) {
  const actorId = String(c.get('user')?.id || 'anonymous').trim() || 'anonymous';
  return `${ORDER_CREATE_COMMAND_TYPE}:${actorId}`;
}

function sanitizeOrderCreateResponse(response = {}) {
  const { fileIds: _fileIds, ...publicResponse } = response || {};
  return publicResponse;
}

async function reserveOrderCreateCommand(c, { requestFingerprint }) {
  const commandIdempotencyRepo = new CommandIdempotencyRepository(c.env.DB);
  const idempotencyKey = getIdempotencyKey(c);
  const reservation = await commandIdempotencyRepo.reserveCommand(
    ORDER_CREATE_COMMAND_TYPE,
    getCreateCommandScopeKey(c),
    idempotencyKey,
    requestFingerprint
  );

  if (reservation?.existing) {
    if (reservation.record?.request_fingerprint !== requestFingerprint) {
      throw new BadRequestError('同一个幂等键不能提交不同的订单创建请求');
    }

    const storedResponse = parseStoredResponse(reservation.record?.response_json);
    if (reservation.record?.status === 'failed' && storedResponse) {
      return {
        replay: null,
        resume: storedResponse,
        reservation,
        commandIdempotencyRepo,
      };
    }

    return {
      replay: replayReservedCommand(reservation, requestFingerprint, {
        mismatchMessage: '同一个幂等键不能提交不同的订单创建请求',
        inFlightMessage: '当前幂等键对应的订单创建命令仍在处理中',
      }),
      resume: null,
      reservation,
      commandIdempotencyRepo,
    };
  }

  return {
    replay: null,
    resume: null,
    reservation,
    commandIdempotencyRepo,
  };
}

/**
 * POST / - 管理端创建订单
 */
app.post('/', zValidator('json', CreateAdminOrderSchema), async (c) => {
  const body = c.req.valid('json');
  const requestFingerprint = buildOrderCreateRequestFingerprint(body);
  const { replay, resume, reservation, commandIdempotencyRepo } = await reserveOrderCreateCommand(
    c,
    { requestFingerprint }
  );

  if (replay) {
    return c.json({ success: true, data: replay }, 201);
  }

  if (resume) {
    await completeManagedOrderCreateSideEffects(c, resume, {
      user: c.get('user'),
      commandId: reservation.record?.command_id,
      correlationId: reservation.record?.command_id,
    });
    await publishOrderCreatedByAdmin(c, {
      orderId: resume.id,
      orderNo: resume.orderNo,
      salespersonId: body.salespersonId,
      actorName: c.get('user')?.name || 'Admin',
      commandId: reservation.record?.command_id,
      correlationId: reservation.record?.command_id,
    });
    const responseData = sanitizeOrderCreateResponse(resume);
    await commandIdempotencyRepo
      .buildFinalizeStatement(reservation.record?.command_id, responseData)
      .run();
    return c.json({ success: true, data: responseData }, 201);
  }

  const ownsReservation = resolveReservationOwnership(reservation);
  let result = null;

  try {
    result = await createManagedOrder(c, body, c.get('user'), {
      skipOrderCreatedEvent: true,
    });
    await publishOrderCreatedByAdmin(c, {
      orderId: result.id,
      orderNo: result.orderNo,
      salespersonId: body.salespersonId,
      actorName: c.get('user')?.name || 'Admin',
      commandId: reservation.record?.command_id,
      correlationId: reservation.record?.command_id,
    });
    const responseData = sanitizeOrderCreateResponse(result);
    await commandIdempotencyRepo
      .buildFinalizeStatement(reservation.record?.command_id, responseData)
      .run();
  } catch (error) {
    const partialResult = result || error?.partialResult || null;
    if (partialResult) {
      try {
        await commandIdempotencyRepo
          .buildFinalizeStatement(reservation.record?.command_id, partialResult, 'failed')
          .run();
      } catch (finalizeError) {
        console.error('Order create idempotency finalize failed:', finalizeError);
      }
    } else {
      await cleanupReservedCommand({
        commandIdempotencyRepo,
        db: c.env.DB,
        ownsReservation,
        commandId: reservation.record?.command_id,
      });
    }
    throw error;
  }

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
  return c.json({ success: true, data: sanitizeOrderCreateResponse(result) }, 201);
});

/**
 * POST /batch - 批量操作接口
 */
app.post('/batch', zValidator('json', BatchCreateOrderSchema), async (c) => {
  const { env } = c;
  const user = c.get('user');
  const { ids, action, value, reason, force } = c.req.valid('json');
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
      `SELECT id, order_no, salesperson_id, status, archived_at FROM orders WHERE id IN (${normalizedIds.map(() => '?').join(',')})`
    )
      .bind(...normalizedIds)
      .all();
    const archivedOrder = (orders || []).find((order) => order.archived_at);
    if (archivedOrder) {
      throw new BadRequestError('订单已归档，请先恢复后再修改');
    }
    const outOfFlowOrder = (orders || []).find(
      (o) => !canTransitionOrderStatus(o.status, normalizedStatus)
    );
    if (outOfFlowOrder) {
      if (!forceStatusTransition) {
        throw new BadRequestError(
          `Invalid status transition in batch: ${outOfFlowOrder.status} -> ${normalizedStatus}`
        );
      }
      await assertForceStatusTransitionAllowed(c, user, reason);
    }

    // 2. 更新状态
    try {
      await repo.batchUpdateStatus(
        normalizedIds,
        normalizedStatus,
        {
          actorType: 'admin',
          actorName: actorName,
          reason: updateReason,
        },
        { forceStatusTransition }
      );
    } catch (error) {
      if (isInsufficientStockError(error)) {
        throw new BadRequestError('Insufficient stock: cannot mark order as delivered');
      }
      if (isInvalidStatusTransitionError(error)) {
        throw new BadRequestError(`Invalid status transition in batch to ${normalizedStatus}`);
      }
      throw error;
    }

    if (orders && orders.length > 0) {
      const demandService = new DemandService(env.DB);
      for (const order of orders) {
        const detail = await repo.findById(order.id);
        if (!detail) continue;

        if (Array.isArray(detail.lines) && detail.lines.length > 1) {
          await syncOrderDemandTransitionsByLines(demandService, {
            orderId: order.id,
            previousStatus: order.status,
            nextStatus: normalizedStatus,
            previousLines: detail.lines,
            nextLines: detail.lines,
            previousFallback: {
              productId: detail.productId,
              variantId: detail.variantId,
              quantity: detail.quantity,
            },
            nextFallback: {
              productId: detail.productId,
              variantId: detail.variantId,
              quantity: detail.quantity,
            },
          });
        } else {
          await syncOrderDemandTransitions(demandService, {
            orderId: order.id,
            previousStatus: order.status,
            nextStatus: normalizedStatus,
            previousQuantity: detail.quantity,
            nextQuantity: detail.quantity,
            previousVariantId: detail.variantId,
            nextVariantId: detail.variantId,
          });
        }
      }
    }

    if (orders && orders.length > 0) {
      const publisher = new DomainOutboxPublisher(env.DB);
      await publisher.publish(
        orders.map((order) => ({
          event_type: 'order_status_changed_by_admin',
          aggregate_type: 'order',
          aggregate_id: order.id,
          payload: {
            order_id: order.id,
            order_no: order.order_no,
            salesperson_id: order.salesperson_id || null,
            actor_name: actorName,
            status: normalizedStatus,
            force: forceStatusTransition,
            batch: true,
          },
        }))
      );
      c.executionCtx.waitUntil(
        runOutboxPoller({
          env,
          requestUrl: c.req.url,
          workerId: `order-batch:${normalizedIds.join(',')}:${normalizedStatus}`,
        })
      );
    }
  }
  scheduleAuditEvent(c, {
    domain: 'orders',
    action: 'order.batch_update',
    result: 'success',
    severity: 'high',
    targetType: 'order',
    summary: `Batch updated ${normalizedIds.length} orders`,
    metadata: {
      count: normalizedIds.length,
      action: normalizedAction,
      status: normalizedStatus,
      force: Boolean(force),
    },
  });

  return c.json({
    success: true,
    message: MSG.ORDER.BATCH_RESULT.replace('{valid}', normalizedIds.length),
  });
});

export default app;
