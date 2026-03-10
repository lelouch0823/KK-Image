import { BadRequestError } from '../lib/hono/errors.js';

const DEMAND_ACTIVE_STATUS = 'confirmed';
const DEMAND_RELEASE_STATUSES = new Set(['void', 'rejected', 'cancelled']);
const SHIPMENT_PREP_STATUSES = new Set(['shipping', 'delivered']);

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
    return {
      createsDemand: normalizedTo === DEMAND_ACTIVE_STATUS && normalizedFrom !== DEMAND_ACTIVE_STATUS,
      releasesDemand: normalizedFrom === DEMAND_ACTIVE_STATUS && DEMAND_RELEASE_STATUSES.has(normalizedTo),
      stockDeductionPending: SHIPMENT_PREP_STATUSES.has(normalizedTo),
    };
  }

  async syncOrderTransition(payload = {}) {
    return this.getTransitionEffect(payload);
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
