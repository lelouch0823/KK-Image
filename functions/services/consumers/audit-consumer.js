/**
 * DomainOutboxConsumers — 审计事件 consumer
 *
 * 从领域事件中提取审计信息，写入审计日志。
 */
import { recordAuditEvent } from '../../lib/hono/_shared/audit-helpers.js';
import { safeJsonParse } from '../../api/utils/json.js';
import { isOrderMutationEvent, resolveOrderId, resolvePurchaseOrderId } from './_shared.js';

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
