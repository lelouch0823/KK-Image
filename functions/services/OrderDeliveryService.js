import { BadRequestError, NotFoundError } from '../lib/hono/errors.js';
import { OrderRepository } from '../repositories/OrderRepository.js';
import { normalizeOrderStatus } from '../api/utils/order-state-machine.js';
import { toNonNegativeInt } from '../api/utils/number.js';

function normalizeDeliveryStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (
    ['not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned'].includes(
      normalized
    )
  ) {
    return normalized;
  }
  return '';
}

function normalizeFulfillmentStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (['unfulfilled', 'partially_fulfilled', 'fulfilled'].includes(normalized)) {
    return normalized;
  }
  return '';
}

function deriveFulfillmentStatus(order = {}) {
  const ordered = toNonNegativeInt(order.ordered_qty);
  const shipped = toNonNegativeInt(order.shipped_qty);
  const cancelled = toNonNegativeInt(order.cancelled_qty);
  const remaining = Math.max(ordered - cancelled, 0);

  if (remaining > 0 && shipped >= remaining) return 'fulfilled';
  if (shipped > 0) return 'partially_fulfilled';
  return 'unfulfilled';
}

export class OrderDeliveryService {
  constructor(db, deps = {}) {
    this.db = db;
    this.orderRepo = deps.orderRepo || new OrderRepository(db);
    this.now = deps.now || (() => Date.now());
  }

  async confirmDelivery(orderId, payload = {}, options = {}) {
    const order = await this.requireOrder(orderId);
    this.assertConfirmable(order);

    const timestamp = this.now();
    const note = String(payload?.note || '').trim();
    const actorName = options.actorName || null;

    const result = await this.orderRepo.markDelivered(orderId, {
      timestamp,
      deliveredBy: actorName,
      note,
    });
    if ((result?.changes || 0) !== 1) {
      throw new BadRequestError('订单已归档，请先恢复后再修改');
    }

    return {
      orderId,
      deliveryStatus: 'delivered',
      deliveredAt: timestamp,
      deliveredBy: actorName,
      deliveryNote: note,
    };
  }

  async requireOrder(orderId) {
    const row = await this.orderRepo.findWithDeliveryInfo(orderId);

    if (!row) {
      throw new NotFoundError('order not found');
    }

    return row;
  }

  assertConfirmable(order) {
    const orderStatus = normalizeOrderStatus(order?.status);
    const deliveryStatus = normalizeDeliveryStatus(order?.delivery_status);
    const explicitFulfillmentStatus = normalizeFulfillmentStatus(order?.fulfillment_status);
    const derivedFulfillmentStatus = deriveFulfillmentStatus(order);
    const remaining = Math.max(
      toNonNegativeInt(order?.ordered_qty) - toNonNegativeInt(order?.cancelled_qty),
      0
    );
    const shipped = toNonNegativeInt(order?.shipped_qty);

    if (deliveryStatus === 'returned') {
      throw new BadRequestError('cannot confirm delivery on a returned order');
    }
    if (deliveryStatus === 'delivered' || toNonNegativeInt(order?.delivered_at) > 0) {
      throw new BadRequestError('delivery is already confirmed');
    }
    if (orderStatus !== 'fulfilled') {
      throw new BadRequestError(
        'delivery confirmation requires a fulfilled order with all shippable quantity shipped'
      );
    }
    if (explicitFulfillmentStatus !== 'fulfilled' && derivedFulfillmentStatus !== 'fulfilled') {
      throw new BadRequestError(
        'delivery confirmation requires a fulfilled order with all shippable quantity shipped'
      );
    }
    if (remaining <= 0 || shipped < remaining) {
      throw new BadRequestError(
        'delivery confirmation requires a fulfilled order with all shippable quantity shipped'
      );
    }
  }
}
