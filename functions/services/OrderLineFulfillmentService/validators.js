import { BadRequestError, NotFoundError } from '../../lib/hono/errors.js';
import { toNonNegativeInt } from '../../api/utils/number.js';

export async function queryOrderLine(db, orderId, lineId) {
  const row = await db
    .prepare(
      `SELECT
          o.id AS order_id,
          o.order_no,
          o.salesperson_id,
          o.status AS order_status,
          o.delivery_status,
          ol.id AS line_id,
          ol.product_id,
          ol.variant_id,
          ol.ordered_qty,
          ol.procured_qty,
          ol.received_qty,
          ol.reserved_qty,
          ol.shipped_qty,
          ol.cancelled_qty,
          ol.display_status
       FROM orders o
       JOIN order_lines ol ON ol.order_id = o.id
       WHERE o.id = ?
         AND o.archived_at IS NULL
         AND ol.id = ?
       LIMIT 1`
    )
    .bind(orderId, lineId)
    .first();

  if (!row) {
    throw new NotFoundError('order line not found');
  }

  return row;
}

export function assertVariantBacked(line) {
  if (!line?.variant_id) {
    throw new BadRequestError('order line is not bound to a variant');
  }
}

export function assertUnshipAllowed(line) {
  const orderStatus = String(line?.order_status || '')
    .trim()
    .toLowerCase();
  const deliveryStatus = String(line?.delivery_status || '')
    .trim()
    .toLowerCase();
  if (
    orderStatus === 'delivered' ||
    ['delivered', 'partially_returned', 'returned'].includes(deliveryStatus)
  ) {
    throw new BadRequestError('cannot unship line from a delivered order');
  }
}

export function assertReturnAllowed(line) {
  const orderStatus = String(line?.order_status || '')
    .trim()
    .toLowerCase();
  const deliveryStatus = String(line?.delivery_status || '')
    .trim()
    .toLowerCase();
  // fulfilled 状态等同于已交付，允许退货
  if (orderStatus === 'fulfilled') {
    return;
  }
  if (!['delivered', 'partially_returned', 'returned'].includes(deliveryStatus)) {
    throw new BadRequestError('returns require a delivery-confirmed order');
  }
}

export async function queryReturnedQuantity(db, lineId) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(quantity), 0) AS returned_qty
       FROM order_returns
       WHERE order_line_id = ?
         AND status != 'cancelled'`
    )
    .bind(lineId)
    .first();

  return toNonNegativeInt(row?.returned_qty);
}

export async function queryDerivedDeliveryStatus(db, orderId, addedReturnedQty) {
  const row = await db
    .prepare(
      `SELECT
          COALESCE(SUM(ol.shipped_qty), 0) AS shipped_qty,
          COALESCE(SUM(orq.returned_qty), 0) AS returned_qty
       FROM order_lines ol
       LEFT JOIN (
           SELECT
               order_line_id,
               COALESCE(SUM(quantity), 0) AS returned_qty
           FROM order_returns
           WHERE status != 'cancelled'
           GROUP BY order_line_id
       ) orq ON orq.order_line_id = ol.id
       WHERE ol.order_id = ?`
    )
    .bind(orderId)
    .first();

  const shippedQty = toNonNegativeInt(row?.shipped_qty);
  const returnedQty = toNonNegativeInt(row?.returned_qty) + toNonNegativeInt(addedReturnedQty);
  if (shippedQty > 0 && returnedQty >= shippedQty) return 'returned';
  if (returnedQty > 0) return 'partially_returned';
  return 'delivered';
}
