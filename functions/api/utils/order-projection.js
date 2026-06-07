/**
 * 订单行状态投影工具
 * 根据订单行的数量字段推算显示状态（纯函数，无副作用）
 *
 * 从 OrderStatusProjectionService 提取为共享工具，
 * 使 Repository 层可以直接使用而不反向依赖 Service。
 *
 * @module api/utils/order-projection
 */

import { toNonNegativeInt } from './number.js';

export function projectOrderLineStatus(line = {}) {
  const ordered = toNonNegativeInt(
    line.orderedQuantity ?? line.ordered_quantity ?? line.ordered_qty ?? line.quantity
  );
  const procured = toNonNegativeInt(
    line.procuredQuantity ?? line.procured_quantity ?? line.procured_qty
  );
  const received = toNonNegativeInt(
    line.receivedQuantity ?? line.received_quantity ?? line.received_qty
  );
  const shipped = toNonNegativeInt(
    line.shippedQuantity ?? line.shipped_quantity ?? line.shipped_qty
  );
  const cancelled = toNonNegativeInt(
    line.cancelledQuantity ?? line.cancelled_quantity ?? line.cancelled_qty
  );
  const remaining = Math.max(ordered - cancelled, 0);

  if (ordered > 0 && cancelled >= ordered) return 'cancelled';
  if (remaining > 0 && shipped >= remaining) return 'completed';
  if (shipped > 0) return 'partially_shipped';
  if (remaining > 0 && received >= remaining) return 'ready';
  if (received > 0) return 'partially_received';
  if (remaining > 0 && procured >= remaining) return 'fully_procured';
  if (procured > 0) return 'partially_procured';
  return 'unprocured';
}
