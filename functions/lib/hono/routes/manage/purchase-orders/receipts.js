/**
 * 采购单路由 - 收货、收货冲销、缺口关闭
 * =======================================
 *
 * @module routes/manage/purchase-orders/receipts
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PurchaseOrderRepository } from '../../../../../repositories/PurchaseOrderRepository.js';
import { OrderProcurementDomainService } from '../../../../../services/OrderProcurementDomainService.js';
import { OrderProcurementReceiptReversalService } from '../../../../../services/OrderProcurementReceiptReversalService.js';
import { PurchaseOrderShortageClosureService } from '../../../../../services/PurchaseOrderShortageClosureService.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import { NotFoundError } from '../../../errors.js';
import { requireEntity } from '../../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import {
  PurchaseOrderReceiptSchema,
  PurchaseOrderReceiptReversalSchema,
  ShortageClosureSchema,
} from '../../../schemas/purchase-order.js';
import { getIdempotencyKey } from './helpers.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/:id/receipts',
    domain: 'purchase-orders',
    action: 'purchase_order.receipt.create',
    severity: 'high',
    targetType: 'purchase_order',
    runtimeAssertionLevel: 'runtime',
  },
  {
    method: 'POST',
    path: '/:id/receipts/:receiptId/reversal',
    domain: 'purchase-orders',
    action: 'purchase_order.receipt.reverse',
    severity: 'critical',
    targetType: 'purchase_order',
  },
  {
    method: 'POST',
    path: '/:id/shortage-closures',
    domain: 'purchase-orders',
    action: 'purchase_order.shortage.close',
    severity: 'high',
    targetType: 'purchase_order',
  },
]);

/**
 * POST /:id/receipts — 采购收货 (partial receipts)
 * Body: { items: [{ purchase_order_item_id, received_qty, note? }] }
 */
app.post('/:id/receipts', zValidator('json', PurchaseOrderReceiptSchema), async (c) => {
  const poId = c.req.param('id');
  const body = c.req.valid('json');
  const idempotencyKey = getIdempotencyKey(c);

  const repo = new PurchaseOrderRepository(c.env.DB);
  await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));

  const domain = new OrderProcurementDomainService(c.env.DB);
  const result = await domain.recordPurchaseOrderReceipts(poId, body, {
    idempotencyKey,
  });
  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId: `request:${poId}:${idempotencyKey}`,
    })
  );

  return c.json({ success: true, data: result }, 201);
});

/**
 * POST /:id/receipts/:receiptId/reversal — 收货冲销
 */
app.post(
  '/:id/receipts/:receiptId/reversal',
  zValidator('json', PurchaseOrderReceiptReversalSchema),
  async (c) => {
    const poId = c.req.param('id');
    const receiptId = c.req.param('receiptId');
    const body = c.req.valid('json');
    const idempotencyKey = getIdempotencyKey(c);

    const repo = new PurchaseOrderRepository(c.env.DB);
    await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));

    const reversalService = new OrderProcurementReceiptReversalService(c.env.DB);
    const result = await reversalService.reverseReceipt(poId, receiptId, body, {
      idempotencyKey,
    });
    scheduleAuditEvent(c, {
      domain: 'purchase-orders',
      action: 'purchase_order.receipt.reverse',
      result: 'success',
      severity: 'critical',
      targetType: 'purchase_order',
      targetId: poId,
      target_label: poId,
      summary: `Reversed receipt ${receiptId} for purchase order ${poId}`,
      metadata: {
        receiptId,
        reversalId: result?.reversal_id || null,
        reversalQty: result?.reversal_qty || null,
      },
    });
    c.executionCtx.waitUntil(
      runOutboxPoller({
        env: c.env,
        requestUrl: c.req.url,
        workerId: `reversal:${poId}:${receiptId}:${idempotencyKey}`,
      })
    );

    return c.json({ success: true, data: result }, 201);
  }
);

/**
 * POST /:id/shortage-closures — 缺口关闭
 */
app.post('/:id/shortage-closures', zValidator('json', ShortageClosureSchema), async (c) => {
  const poId = c.req.param('id');
  const body = c.req.valid('json');
  const idempotencyKey = getIdempotencyKey(c);

  const repo = new PurchaseOrderRepository(c.env.DB);
  await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));

  const shortageClosureService = new PurchaseOrderShortageClosureService(c.env.DB);
  const result = await shortageClosureService.closeShortages(poId, body, {
    idempotencyKey,
  });

  const publisher = new DomainOutboxPublisher(c.env.DB);
  const events = [
    {
      event_type: 'purchase_order_updated',
      aggregate_type: 'purchase_order',
      aggregate_id: poId,
      payload: {
        purchase_order_id: poId,
        shortage_closed_count: result?.closed_count || 0,
        shortage_closed_items: Array.isArray(result?.items) ? result.items.length : 0,
      },
    },
  ];
  if (
    Array.isArray(result?.changedOrderProgressions) &&
    result.changedOrderProgressions.length > 0
  ) {
    events.push(
      ...result.changedOrderProgressions.map((progression) => ({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: progression.orderId,
        payload: {
          purchase_order_id: poId,
          order_id: progression.orderId,
          order_line_id: progression.orderLineId,
          order_line_display_status_after: progression.orderLineDisplayStatus,
          procurement_status_after: progression.procurementStatus,
          order_procurement_status_after: progression.procurementStatus,
          trigger: 'purchase_order_shortage_closed',
        },
      }))
    );
  } else if (
    Array.isArray(result?.changedOrderStatuses) &&
    result.changedOrderStatuses.length > 0
  ) {
    events.push(
      ...result.changedOrderStatuses.map(({ orderId, procurementStatus }) => ({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: orderId,
        payload: {
          purchase_order_id: poId,
          order_id: orderId,
          procurement_status_after: procurementStatus,
          order_procurement_status_after: procurementStatus,
          trigger: 'purchase_order_shortage_closed',
        },
      }))
    );
  }
  await publisher.publish(events);
  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId: `purchase_order_shortage_closed:${poId}:${idempotencyKey}`,
    })
  );
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.shortage.close',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Closed purchase order shortages for ${poId}`,
    metadata: {
      closedCount: result?.closed_count || 0,
      items: result?.items || [],
    },
  });

  return c.json({ success: true, data: result }, 201);
});

export default app;
