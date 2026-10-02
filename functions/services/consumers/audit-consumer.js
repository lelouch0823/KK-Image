/**
 * DomainOutboxConsumers — 审计事件 consumer
 *
 * 从领域事件中提取审计信息，写入审计日志。
 */
import { recordAuditEvent } from '../../lib/hono/_shared/audit-helpers.js';
import { safeJsonParse } from '../../api/utils/json.js';
import { isOrderMutationEvent, resolveOrderId, resolvePurchaseOrderId } from './_shared.js';

const INVENTORY_AUDIT_EVENTS = new Set(['inventory_received', 'inventory_receipt_reversed']);

function resolveAuditEventConfig(event, payload) {
  if (isOrderMutationEvent(event?.event_type)) {
    const isComment = String(event?.event_type || '').includes('comment');
    const isStatus = String(event?.event_type || '').includes('status');
    const isCreate = String(event?.event_type || '').includes('created');
    return {
      action: isComment
        ? 'order.comment.create'
        : isStatus
          ? 'order.status.change'
          : isCreate
            ? 'order.create'
            : 'order.update',
      severity: isComment ? 'normal' : 'high',
      purchaseOrderId: resolveOrderId(event, payload),
    };
  }

  // 库存台账事件：不是采购单事件，按库存域记录（此前落入采购分支，
  // 导致 target_type=purchase_order、targetId=null 的错误审计行）
  if (INVENTORY_AUDIT_EVENTS.has(event?.event_type)) {
    const isReversal = event?.event_type === 'inventory_receipt_reversed';
    return {
      isInventory: true,
      action: isReversal ? 'inventory.receipt.reverse' : 'inventory.receipt.record',
      severity: isReversal ? 'critical' : 'normal',
      targetId: payload.purchase_receipt_id || event.aggregate_id || null,
    };
  }

  const purchaseOrderId =
    resolvePurchaseOrderId(event, payload) ||
    payload.order_id ||
    payload.orderId ||
    event.aggregate_id ||
    null;
  const isReversal = String(event?.event_type || '').includes('reversed');

  return {
    action: isReversal ? 'purchase_order.receipt.reverse' : 'purchase_order.receipt.create',
    severity: isReversal ? 'critical' : 'high',
    purchaseOrderId,
  };
}

export async function auditOutboxEvent({ db, event }) {
  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json || null : null,
    {}
  );
  const auditConfig = resolveAuditEventConfig(event, payload);

  // 库存台账事件走独立的审计域，与采购单事件分开记录
  if (auditConfig.isInventory) {
    await recordAuditEvent(db, {
      domain: 'inventory',
      action: auditConfig.action,
      result: 'success',
      severity: auditConfig.severity,
      targetType: 'inventory_event',
      targetId: auditConfig.targetId,
      target_label: auditConfig.targetId,
      summary: `${event.event_type} for receipt ${auditConfig.targetId}`,
      metadata: {
        eventId: event.id,
        eventType: event.event_type,
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        variantId: payload.variant_id || null,
        receiptId: payload.purchase_receipt_id || payload.receipt_id || null,
        quantityDelta: payload.quantity_delta ?? null,
        correlationId: event.correlation_id || null,
      },
    });
    return;
  }

  await recordAuditEvent(db, {
    domain: 'purchase-orders',
    action: auditConfig.action,
    result: 'success',
    severity: auditConfig.severity,
    targetType: 'purchase_order',
    targetId: auditConfig.purchaseOrderId,
    target_label: auditConfig.purchaseOrderId,
    summary: `Processed ${event.event_type} for purchase order ${auditConfig.purchaseOrderId}`,
    metadata: {
      eventId: event.id,
      eventType: event.event_type,
      aggregateType: event.aggregate_type,
      aggregateId: event.aggregate_id,
      purchaseOrderItemId: payload.purchase_order_item_id || null,
      orderId: payload.order_id || null,
      orderLineId: payload.order_line_id || null,
      receiptId: payload.receipt_id || payload.purchase_receipt_id || null,
      originalReceiptId: payload.original_receipt_id || null,
      reversalId: payload.reversal_id || null,
      receivedQty: payload.received_qty ?? payload.received_qty_delta ?? null,
      reversalQty: payload.reversal_qty ?? null,
      correlationId: event.correlation_id || null,
    },
  });
}
