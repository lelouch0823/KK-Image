import {
  getPurchaseOrderCancelledQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
  projectPurchaseOrderDisplayStatus,
} from '../../shared/utils/purchase-order-projection.js';

export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizePurchaseOrderProgress(row = {}) {
  return {
    ...row,
    item_count: toNumber(row.item_count),
    ordered_qty: getPurchaseOrderOrderedQty(row),
    received_qty: getPurchaseOrderReceivedQty(row),
    cancelled_qty: getPurchaseOrderCancelledQty(row),
    outstanding_qty: getPurchaseOrderOutstandingQty(row),
    total_goods_cost: toNumber(row.total_goods_cost),
    receipt_count: toNumber(row.receipt_count),
    display_status: row.display_status || projectPurchaseOrderDisplayStatus(row),
  };
}

export function summarizePurchaseOrderItems(items = []) {
  return normalizePurchaseOrderProgress(
    items.reduce(
      (acc, item) => ({
        item_count: acc.item_count + 1,
        ordered_qty: acc.ordered_qty + getPurchaseOrderOrderedQty(item),
        received_qty: acc.received_qty + getPurchaseOrderReceivedQty(item),
        cancelled_qty: acc.cancelled_qty + getPurchaseOrderCancelledQty(item),
        outstanding_qty: acc.outstanding_qty + getPurchaseOrderOutstandingQty(item),
        total_goods_cost: acc.total_goods_cost + toNumber(item.quantity) * toNumber(item.unit_cost),
        receipt_count: acc.receipt_count + toNumber(item.receipt_count),
        last_received_at: Math.max(acc.last_received_at, toNumber(item.last_received_at)),
      }),
      {
        item_count: 0,
        ordered_qty: 0,
        received_qty: 0,
        cancelled_qty: 0,
        outstanding_qty: 0,
        total_goods_cost: 0,
        receipt_count: 0,
        last_received_at: 0,
      }
    )
  );
}
