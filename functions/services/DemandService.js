import { generateId } from '../api/utils/id.js';
import { BadRequestError } from '../lib/hono/errors.js';
import { VariantDemandProjectionRepository } from '../repositories/VariantDemandProjectionRepository.js';
import { queryOrderLineCandidates } from './order-line-shared.js';

const DEMAND_ACTIVE_STATUSES = new Set(['confirmed', 'production', 'shipping', 'arrived']);
const DEMAND_RELEASE_STATUSES = new Set(['void', 'rejected', 'cancelled']);
const RESERVATION_ACTIVE_STATUSES = new Set(['confirmed', 'production', 'shipping', 'arrived']);
const SHIPMENT_PREP_STATUSES = new Set(['shipping', 'fulfilled', 'delivered']);
const SHIPMENT_CONSUME_STATUSES = new Set(['fulfilled', 'delivered']);

export class DemandService {
  constructor(db) {
    this.db = db;
    this.projectionRepo = new VariantDemandProjectionRepository(db);
  }

  async queryOrderLineCandidates(payload = {}, includeScopedFilters = true) {
    return queryOrderLineCandidates(this.db, payload, includeScopedFilters);
  }

  async resolveOrderLineId(payload = {}) {
    if (payload.orderLineId) return payload.orderLineId;
    if (!payload.orderId || typeof this.db?.prepare !== 'function') return null;

    const candidates = await this.queryOrderLineCandidates(payload, true);
    if (candidates.length === 1) return candidates[0]?.id || null;
    if (candidates.length > 1) {
      throw new BadRequestError('orderLineId is required for multi-line orders');
    }

    if (payload.variantId || payload.productId) {
      const fallback = await this.queryOrderLineCandidates(payload, false);
      if (fallback.length === 1) return fallback[0]?.id || null;
      if (fallback.length > 1) {
        throw new BadRequestError('orderLineId is required for multi-line orders');
      }
    }

    return null;
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
      createsDemand: !DEMAND_ACTIVE_STATUSES.has(normalizedFrom) && DEMAND_ACTIVE_STATUSES.has(normalizedTo),
      releasesDemand: DEMAND_ACTIVE_STATUSES.has(normalizedFrom) && DEMAND_RELEASE_STATUSES.has(normalizedTo),
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

    const result = {
      ...effect,
      reservationDelta,
      shipmentDelta: effect.consumesReservation ? -quantity : 0,
    };

    if (typeof this.db?.prepare === 'function' && payload?.variantId && reservationDelta !== 0) {
      const timestamp = Date.now();
      const orderLineId = await this.resolveOrderLineId(payload);
      const sourceId = payload.orderId || payload.variantId;
      const reservationMetadata = JSON.stringify({
        fromStatus: payload.fromStatus || null,
        toStatus: payload.toStatus || null,
      });
      const eventType = reservationDelta > 0 ? 'reservation_hold' : 'reservation_release';

      await this.db.batch([
        this.db.prepare(
          `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
           VALUES (?, 0, ?, 0, ?)
           ON CONFLICT(variant_id) DO UPDATE SET
             reserved = MAX(0, inventory_balances.reserved + ?),
             available = MAX(0, inventory_balances.on_hand - MAX(0, inventory_balances.reserved + ?)),
             updated_at = excluded.updated_at`
        ).bind(
          payload.variantId,
          Math.max(reservationDelta, 0),
          timestamp,
          reservationDelta,
          reservationDelta
        ),
        this.db.prepare(
          `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          generateId(),
          payload.variantId,
          eventType,
          reservationDelta,
          'order',
          sourceId,
          timestamp,
          reservationMetadata,
          timestamp
        ),
        this.db.prepare(
          `INSERT INTO inventory_events (
            id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta,
            source_type, source_id, metadata, occurred_at, created_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          generateId(),
          payload.variantId,
          orderLineId,
          eventType,
          reservationDelta,
          'order',
          sourceId,
          reservationMetadata,
          timestamp,
          timestamp
        ),
      ]);
    }

    const fromStatus = String(payload?.fromStatus || '').trim();
    const toStatus = String(payload?.toStatus || '').trim();
    const projectionNeedsRefresh = Boolean(payload?.variantId) && fromStatus !== toStatus && (
      DEMAND_ACTIVE_STATUSES.has(fromStatus)
      || DEMAND_ACTIVE_STATUSES.has(toStatus)
      || effect.createsDemand
      || effect.releasesDemand
    );
    if (projectionNeedsRefresh) {
      await this.projectionRepo.refreshByVariantId(payload.variantId);
    }

    return result;
  }

  async getDemandSummaryByVariant() {
    const rows = await this.projectionRepo.listAll();
    return rows.map((row) => ({
      variant_id: row.variant_id,
      total_demand: Number(row.total_demand || 0),
      order_count: Number(row.order_count || 0),
      order_ids: Array.isArray(row.order_ids) ? row.order_ids : [],
    }));
  }
}
