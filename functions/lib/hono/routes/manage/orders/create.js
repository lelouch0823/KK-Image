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
import { buildRequestFingerprint, getCommandScopeKey } from '../../_shared/command-idempotency.js';
import {
  cleanupReservedCommand,
  parseStoredResponse,
  replayReservedCommand,
  resolveReservationOwnership,
} from '../../../../../services/order-procurement-shared.js';
import {
  buildOrderDemandSyncTransitionsByLines,
  syncOrderDemandTransitions,
  syncOrderDemandTransitionsByLines,
} from '../../../../../api/utils/order-demand-sync.js';
import { maybeReleaseLineReservations } from '../../../../../services/order-terminal-cleanup.js';

const app = new Hono();
const ORDER_CREATE_COMMAND_TYPE = 'order_create';

/**
 * R4（F4）：幂等 resume 补放缺失的需求预留同步。
 *
 * createManagedOrder 的 demand sync 逐 transition 执行，失败时 partialResult
 * 携带 demandSyncedVariants（已完成部分）。resume 分支按订单当前行重建
 * transitions（previousStatus: null 创建语义），跳过已完成的 variant 补执行
 * 其余；全部完成或行无变体时不产生任何语句。历史 failed 记录无该字段时
 * 跳过并告警（无法安全重放，只能人工核对预留）。
 */
async function replayMissingDemandSyncForResume(db, resume) {
  if (!resume?.id) return;
  if (resume.demandSyncedVariants === undefined) {
    console.warn(
      `[order-create resume] order ${resume.id} has no demandSyncedVariants in partial result; ` +
        'demand sync progress unknown (legacy failed record) — verify inventory reservations manually'
    );
    return;
  }
  const synced = new Set(resume.demandSyncedVariants || []);
  const orderRepo = new OrderRepository(db);
  const order = typeof orderRepo.findById === 'function' ? await orderRepo.findById(resume.id) : null;
  const lines = Array.isArray(order?.lines) ? order.lines : [];
  if (lines.length === 0) return;
  const nextStatus = resume.orderStatus || order?.status || 'pending';

  const transitions = buildOrderDemandSyncTransitionsByLines({
    orderId: resume.id,
    previousStatus: null,
    nextStatus,
    previousLines: [],
    nextLines: lines,
    previousFallback: {},
    nextFallback: {
      productId: lines.length === 1 ? lines[0]?.productId ?? null : null,
      variantId: lines.length === 1 ? lines[0]?.variantId ?? null : null,
      quantity: Number(order?.quantity) || lines.reduce((sum, l) => sum + (Number(l?.quantity ?? l?.ordered_qty) || 0), 0),
    },
  });
  const demandService = new DemandService(db);
  for (const transition of transitions) {
    if (transition.variantId && synced.has(transition.variantId)) continue;
    await demandService.syncOrderTransition(transition);
  }
}
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

// 指纹归一化与作用域键使用共享实现（与采购单/商品/行级命令保持一致）
const buildOrderCreateRequestFingerprint = (body = {}) => buildRequestFingerprint(body);

const getCreateCommandScopeKey = (c) => getCommandScopeKey(c, ORDER_CREATE_COMMAND_TYPE);

function sanitizeOrderCreateResponse(response = {}) {
  // R4：demandSyncedVariants/orderStatus 是幂等 resume 的内部进度字段，
  // 不进入客户端响应
  const {
    fileIds: _fileIds,
    demandSyncedVariants: _demandSyncedVariants,
    orderStatus: _orderStatus,
    ...publicResponse
  } = response || {};
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
    // R4（F4）：resume 必须补放失败时未完成的需求预留同步——订单行已建但
    // inventory_balances.reserved 的 hold 可能缺失（demand sync 在 create 之后
    // 失败）。partialResult.demandSyncedVariants 记录了已完成部分，按订单
    // 当前行重建 transitions 后跳过已完成的 variant 逐个补执行
    await replayMissingDemandSyncForResume(c.env.DB, resume);
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
      // B11：单订单的同步/清算失败不得中断其余订单——状态已由
      // batchUpdateStatus 全量提交，中途抛错会让后续订单的需求预留
      // 永久滞留。逐单捕获、记录失败明细，最终随响应返回供人工重试
      const syncFailures = [];
      for (const order of orders) {
        try {
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

          // 终态清算：void/rejected 时释放行级预留（B-H1，与订单级释放互补）
          await maybeReleaseLineReservations(env.DB, order.id, order.status, normalizedStatus, {
            actorName,
          });
        } catch (error) {
          console.error(
            `[batchUpdateStatus] post-commit sync failed for order ${order.id}:`,
            error
          );
          syncFailures.push({
            orderId: order.id,
            orderNo: order.order_no || null,
            error: String(error?.message || error),
          });
        }
      }
      if (syncFailures.length > 0) {
        console.warn(
          `[batchUpdateStatus] ${syncFailures.length}/${orders.length} orders failed post-commit sync`,
          syncFailures
        );
        c.set('batchSyncFailures', syncFailures);
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

  // B11：状态已提交但部分订单的预留同步失败时，明确告知调用方
  //（success 仍为 true——状态变更本身已生效，失败的是补偿性同步）
  const batchSyncFailures = c.get('batchSyncFailures') || [];
  return c.json({
    success: true,
    message: MSG.ORDER.BATCH_RESULT.replace('{valid}', normalizedIds.length),
    ...(batchSyncFailures.length > 0
      ? {
          warning: `${batchSyncFailures.length} 个订单的库存预留同步失败，请重试或人工核对`,
          syncFailures: batchSyncFailures,
        }
      : {}),
  });
});

export default app;
