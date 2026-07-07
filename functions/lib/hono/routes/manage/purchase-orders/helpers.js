/**
 * 采购单路由 - 辅助函数
 * =======================
 *
 * 幂等键、fingerprint 构建、校验辅助、审计声明、outbox 发布等工具函数。
 *
 * @module routes/manage/purchase-orders/helpers
 */

import { CommandIdempotencyRepository } from '../../../../../repositories/CommandIdempotencyRepository.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';
import { requireEntity } from '../../../_shared/route-helpers.js';
import { validateOrderQuantity } from '../../../../../services/purchase-order-constraints.js';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import { getIdempotencyKey as _getIdempotencyKey } from '../../_shared/outbox-helpers.js';
import {
  parseStoredResponse,
  replayReservedCommand,
} from '../../../../../services/order-procurement-shared.js';
import { isDuplicateOutboxIdempotencyError } from '../products/idempotency-helpers.js';

export const PURCHASE_ORDER_CREATE_COMMAND_TYPE = 'purchase_order_create';
export const PURCHASE_ORDER_CREATE_FROM_ORDERS_COMMAND_TYPE =
  'purchase_order_create_from_orders';

export async function publishPurchaseOrderCacheEvent(
  c,
  { eventType, poId, payload = {}, commandId, correlationId }
) {
  const publisher = new DomainOutboxPublisher(c.env.DB);
  try {
    await publisher.publish(
      [
        {
          event_type: eventType,
          aggregate_type: 'purchase_order',
          aggregate_id: poId,
          payload: {
            purchase_order_id: poId,
            ...payload,
          },
        },
      ],
      {
        commandId,
        correlationId,
      }
    );
  } catch (error) {
    if (!isDuplicateOutboxIdempotencyError(error)) {
      throw error;
    }
  }

  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId: `${eventType}:${poId}`,
    })
  );
}

export async function requireDraftPurchaseOrder(repo, poId, actionLabel) {
  const po = await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));
  if (po.status !== 'draft') throw new BadRequestError(`仅草稿状态允许${actionLabel}`);
  return po;
}

export async function requireCompletedPurchaseOrder(repo, poId, actionLabel) {
  const po = await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));
  if (po.status !== 'completed') throw new BadRequestError(`仅已结算采购单允许${actionLabel}`);
  return po;
}

/** 重新导出规范版本，保持 purchase-orders 模块对外接口不变 */
export const getIdempotencyKey = _getIdempotencyKey;

export function requireMutationSuccess(success, message) {
  if (!success) throw new NotFoundError(message);
}

export function hasAllocationImpact(body = {}) {
  const allocationFields = [
    'allocation_method',
    'estimated_shipping_cost',
    'estimated_tariff_cost',
    'actual_shipping_cost',
    'actual_tariff_cost',
  ];

  return allocationFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
}

export function buildCreatedPurchaseOrderShell(po = {}, items = []) {
  return {
    ...po,
    items: Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
    receipts: [],
  };
}

function normalizeScalarFingerprintValue(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function normalizeNumericFingerprintValue(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizePurchaseOrderCreateItems(items = []) {
  return [...(Array.isArray(items) ? items : [])]
    .map((item = {}) => ({
      product_id: normalizeScalarFingerprintValue(item.product_id),
      variant_id: normalizeScalarFingerprintValue(item.variant_id),
      pre_order_id: normalizeScalarFingerprintValue(item.pre_order_id),
      order_line_id: normalizeScalarFingerprintValue(item.order_line_id),
      quantity: normalizeNumericFingerprintValue(item.quantity),
      unit_cost: normalizeNumericFingerprintValue(item.unit_cost),
    }))
    .sort((left, right) => {
      const keys = ['product_id', 'variant_id', 'pre_order_id', 'order_line_id'];
      for (const key of keys) {
        const compare = String(left[key] || '').localeCompare(String(right[key] || ''));
        if (compare !== 0) return compare;
      }

      const quantityCompare = Number(left.quantity || 0) - Number(right.quantity || 0);
      if (quantityCompare !== 0) return quantityCompare;
      return Number(left.unit_cost || 0) - Number(right.unit_cost || 0);
    });
}

export function buildPurchaseOrderCreateRequestFingerprint(body = {}) {
  return JSON.stringify({
    remark: normalizeScalarFingerprintValue(body.remark),
    currency: normalizeScalarFingerprintValue(body.currency),
    allocation_method: normalizeScalarFingerprintValue(body.allocation_method),
    estimated_shipping_cost: normalizeNumericFingerprintValue(body.estimated_shipping_cost),
    estimated_tariff_cost: normalizeNumericFingerprintValue(body.estimated_tariff_cost),
    items: normalizePurchaseOrderCreateItems(body.items),
  });
}

export function buildPurchaseOrderCreateFromOrdersRequestFingerprint(orderIds = [], body = {}) {
  return JSON.stringify({
    order_ids: [...new Set((Array.isArray(orderIds) ? orderIds : []).filter(Boolean))].sort(),
    remark: normalizeScalarFingerprintValue(body.remark),
    allocation_method: normalizeScalarFingerprintValue(body.allocation_method),
    estimated_shipping_cost: normalizeNumericFingerprintValue(body.estimated_shipping_cost),
    estimated_tariff_cost: normalizeNumericFingerprintValue(body.estimated_tariff_cost),
  });
}

export function getCreateCommandScopeKey(c, suffix) {
  const actorId = String(c.get('user')?.id || 'anonymous').trim() || 'anonymous';
  return `${suffix}:${actorId}`;
}

export async function reserveCreateCommand(
  c,
  { commandType, scopeKey, requestFingerprint, mismatchMessage, inFlightMessage }
) {
  const commandIdempotencyRepo = new CommandIdempotencyRepository(c.env.DB);
  const idempotencyKey = getIdempotencyKey(c);
  const reservation = await commandIdempotencyRepo.reserveCommand(
    commandType,
    scopeKey,
    idempotencyKey,
    requestFingerprint
  );

  if (reservation?.existing) {
    if (reservation.record?.request_fingerprint !== requestFingerprint) {
      throw new BadRequestError(mismatchMessage);
    }

    const storedResponse = parseStoredResponse(reservation.record?.response_json);
    if (reservation.record?.status === 'failed' && storedResponse) {
      return {
        replay: null,
        resume: storedResponse,
        reservation,
        commandIdempotencyRepo,
        idempotencyKey,
      };
    }

    return {
      replay: replayReservedCommand(reservation, requestFingerprint, {
        mismatchMessage,
        inFlightMessage,
      }),
      resume: null,
      reservation,
      commandIdempotencyRepo,
      idempotencyKey,
    };
  }

  return {
    replay: null,
    resume: null,
    reservation,
    commandIdempotencyRepo,
    idempotencyKey,
  };
}

export async function validateExistingItemQuantityUpdate(db, item, nextQuantity) {
  if (!item?.variant_id || nextQuantity === undefined || nextQuantity === null) return;

  if (item?.pre_order_id) {
    const { results } = await db
      .prepare(
        `
        SELECT id, status, product_id, variant_id, quantity
        FROM orders
        WHERE id = ?
          AND archived_at IS NULL
      `
      )
      .bind(item.pre_order_id)
      .all();
    const linkedOrder = (results || [])[0] || null;

    let matchedOrderLine = null;
    if (linkedOrder?.status === 'confirmed') {
      if (item?.order_line_id) {
        const { results: lineResults } = await db
          .prepare(
            `
            SELECT id, order_id, product_id, variant_id, ordered_qty, cancelled_qty, shipped_qty
            FROM order_lines
            WHERE order_id = ? AND id = ?
          `
          )
          .bind(item.pre_order_id, item.order_line_id)
          .all();
        matchedOrderLine = (lineResults || [])[0] || null;
        if (!matchedOrderLine) {
          throw new BadRequestError('pre_order_id 与 order_line_id 不匹配');
        }
        if (
          matchedOrderLine.product_id !== item.product_id ||
          matchedOrderLine.variant_id !== item.variant_id
        ) {
          throw new BadRequestError('pre_order_id 与商品/变体不匹配');
        }
      }

      const expectedQuantity = matchedOrderLine
        ? Number.parseInt(
            String(
              Math.max(
                Number(matchedOrderLine.ordered_qty || 0) -
                  Number(matchedOrderLine.cancelled_qty || 0) -
                  Number(matchedOrderLine.shipped_qty || 0),
                0
              )
            ).trim(),
            10
          )
        : linkedOrder.product_id === item.product_id && linkedOrder.variant_id === item.variant_id
          ? Number.parseInt(String(linkedOrder.quantity ?? '').trim(), 10)
          : null;

      if (expectedQuantity !== null && Number.isFinite(expectedQuantity)) {
        const requestedQuantity = Number.parseInt(String(nextQuantity ?? '').trim(), 10);
        if (requestedQuantity !== expectedQuantity) {
          throw new BadRequestError('pre_order_id 与订单数量不匹配');
        }
      }
    }
  }

  const { results } = await db
    .prepare(
      `
    SELECT id,
           COALESCE(moq, 1) AS moq,
           COALESCE(pack_size, 1) AS pack_size,
           COALESCE(order_step, 1) AS order_step
    FROM product_variants
    WHERE id = ?
  `
    )
    .bind(item.variant_id)
    .all();
  const variant = (results || [])[0];
  if (!variant) return;

  const result = validateOrderQuantity(nextQuantity || 1, {
    moq: variant.moq,
    orderStep: variant.order_step,
    packSize: variant.pack_size,
  });
  if (!result.valid) {
    throw new BadRequestError(`${result.reason}（建议数量: ${result.suggestedQuantity}）`);
  }
}
