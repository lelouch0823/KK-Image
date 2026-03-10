import { BadRequestError } from '../lib/hono/errors.js';

const DEMAND_ACTIVE_STATUS = 'confirmed';
const DEMAND_RELEASE_STATUSES = new Set(['void', 'rejected', 'cancelled']);
const RESERVATION_ACTIVE_STATUSES = new Set(['confirmed', 'production', 'shipping']);
const SHIPMENT_PREP_STATUSES = new Set(['shipping', 'delivered']);
const SHIPMENT_CONSUME_STATUSES = new Set(['delivered']);

export class DemandService {
  constructor(db) {
    this.db = db;
  }

  getTransitionEffect({ fromStatus = null, toStatus }) {
    const normalizedTo = String(toStatus || '').trim();
    if (!normalizedTo) {
      throw new BadRequestError('toStatus is required');
    }

    const normalizedFrom = String(fromStatus || '').trim() || null;
    const entersReservation = !RESERVATION_ACTIVE_STATUSES.has(normalizedFrom) && RESERVATION_ACTIVE_STATUSES.has(normalizedTo);
    const releasesReservation = RESERVATION_ACTIVE_STATUSES.has(normalizedFrom) && DEMAND_RELEASE_STATUSES.has(normalizedTo);
    const consumesReservation = RESERVATION_ACTIVE_STATUSES.has(normalizedFrom) && SHIPMENT_CONSUME_STATUSES.has(normalizedTo);

    return {
      createsDemand: normalizedTo === DEMAND_ACTIVE_STATUS && normalizedFrom !== DEMAND_ACTIVE_STATUS,
      releasesDemand: normalizedFrom === DEMAND_ACTIVE_STATUS && DEMAND_RELEASE_STATUSES.has(normalizedTo),
      stockDeductionPending: SHIPMENT_PREP_STATUSES.has(normalizedTo),
      entersReservation,
      releasesReservation,
      consumesReservation,
    };
  }

  async syncOrderTransition(payload = {}) {
    const effect = this.getTransitionEffect(payload);
    const quantity = Math.max(0, Number(payload?.quantity) || 0);

    let reservationDelta = 0;
    if (effect.entersReservation) reservationDelta += quantity;
    if (effect.releasesReservation || effect.consumesReservation) reservationDelta -= quantity;

    return {
      ...effect,
      reservationDelta,
      shipmentDelta: effect.consumesReservation ? -quantity : 0,
    };
  }

  async getDemandSummaryByVariant() {
    const { results } = await this.db.prepare(`
      SELECT
        o.variant_id AS variant_id,
        COALESCE(SUM(o.quantity), 0) AS total_demand,
        COUNT(o.id) AS order_count,
        GROUP_CONCAT(DISTINCT o.id) AS order_ids
      FROM orders o
      WHERE o.status = 'confirmed'
        AND o.variant_id IS NOT NULL
      GROUP BY o.variant_id
    `).all();

    return (results || []).map((row) => ({
      variant_id: row.variant_id,
      total_demand: Number(row.total_demand || 0),
      order_count: Number(row.order_count || 0),
      order_ids: row.order_ids ? String(row.order_ids).split(',') : [],
    }));
  }
}
