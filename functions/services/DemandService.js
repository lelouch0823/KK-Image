import { generateId } from '../api/utils/id.js';
import { BadRequestError } from '../lib/hono/errors.js';
import { ORDER_RESERVATION_ACTIVE_STATUSES as RESERVATION_ACTIVE_STATUSES } from '../api/utils/constants.js';
import { VariantDemandProjectionRepository } from '../repositories/VariantDemandProjectionRepository.js';
import { ProductProjectionRefreshService } from './ProductProjectionRefreshService.js';
import {
  buildBalanceDeltaUpsertStatement,
  buildBalanceReservedClampedReleaseStatement,
  normalizeInventoryWriteError,
} from './_shared/inventory-write-statements.js';
import { queryOrderLineCandidates, resolveOrderLineId } from './order-line-shared.js';

const DEMAND_ACTIVE_STATUSES = new Set(['confirmed', 'production', 'shipping', 'arrived']);
const DEMAND_RELEASE_STATUSES = new Set(['void', 'rejected', 'cancelled']);
const SHIPMENT_PREP_STATUSES = new Set(['shipping', 'fulfilled', 'delivered']);
const SHIPMENT_CONSUME_STATUSES = new Set(['fulfilled', 'delivered']);

export class DemandService {
  constructor(db, deps = {}) {
    this.db = db;
    this.projectionRepo = new VariantDemandProjectionRepository(db);
    this.productProjectionRefreshService =
      deps.productProjectionRefreshService || new ProductProjectionRefreshService(db);
  }

  async queryOrderLineCandidates(payload = {}, includeScopedFilters = true) {
    return queryOrderLineCandidates(this.db, payload, includeScopedFilters);
  }

  async resolveOrderLineId(payload = {}) {
    return resolveOrderLineId(this.db, payload);
  }
  getTransitionEffect({ fromStatus = null, toStatus }) {
    const normalizedTo = String(toStatus || '').trim();
    if (!normalizedTo) {
      throw new BadRequestError('toStatus is required');
    }

    const normalizedFrom = String(fromStatus || '').trim() || null;
    const entersReservation =
      !RESERVATION_ACTIVE_STATUSES.has(normalizedFrom) &&
      RESERVATION_ACTIVE_STATUSES.has(normalizedTo);
    const releasesReservation =
      RESERVATION_ACTIVE_STATUSES.has(normalizedFrom) && DEMAND_RELEASE_STATUSES.has(normalizedTo);
    const consumesReservation =
      RESERVATION_ACTIVE_STATUSES.has(normalizedFrom) &&
      SHIPMENT_CONSUME_STATUSES.has(normalizedTo);

    return {
      createsDemand:
        !DEMAND_ACTIVE_STATUSES.has(normalizedFrom) && DEMAND_ACTIVE_STATUSES.has(normalizedTo),
      releasesDemand:
        DEMAND_ACTIVE_STATUSES.has(normalizedFrom) && DEMAND_RELEASE_STATUSES.has(normalizedTo),
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

      try {
        // 订单状态机预留是 inventory_balances.reserved 的唯一写入者（单一
        // 写入者模型，审查 B1）。hold（正增量）严格写入，越限由 0099 CHECK
        // 拒绝；release（负增量）钳位到 0 并在 batch 前后读取实际余额：
        // 本同步在订单状态已提交后执行，严格失败会让订单停留在
        // "状态已变、预留未释放"的中间态（审查 B1 场景 B），钳位 +
        // 实际释放量台账可自愈预留记账的历史漂移
        const isRelease = reservationDelta < 0;
        const readReservedBefore = this.db
          .prepare('SELECT reserved FROM inventory_balances WHERE variant_id = ?')
          .bind(payload.variantId);
        const balanceStatement = isRelease
          ? buildBalanceReservedClampedReleaseStatement(this.db, {
              variantId: payload.variantId,
              reservedDelta: reservationDelta,
              timestamp,
            })
          : buildBalanceDeltaUpsertStatement(this.db, {
              variantId: payload.variantId,
              onHandDelta: 0,
              reservedDelta: reservationDelta,
              timestamp,
            });
        const readReservedAfter = this.db
          .prepare('SELECT reserved FROM inventory_balances WHERE variant_id = ?')
          .bind(payload.variantId);

        const batchResults = await this.db.batch([
          ...(isRelease ? [readReservedBefore] : []),
          balanceStatement,
          this.db
            .prepare(
              `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
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
          this.db
            .prepare(
              `INSERT INTO inventory_events (
            id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta,
            source_type, source_id, metadata, occurred_at, created_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
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
          ...(isRelease ? [readReservedAfter] : []),
        ]);

        if (isRelease) {
          const reservedBefore = Number(batchResults?.[0]?.results?.[0]?.reserved ?? 0);
          const reservedAfter = Number(
            batchResults?.[batchResults.length - 1]?.results?.[0]?.reserved ?? 0
          );
          const actualDelta = reservedAfter - reservedBefore;
          if (actualDelta !== reservationDelta) {
            // 池中可释放量小于请求量：预留记账存在漂移（历史数据或此前
            // 的双记账缺陷）。记录告警供对账，台账仍记请求量以保留审计线索
            console.warn(
              `[DemandService] reservation release clamped: variant=${payload.variantId} ` +
                `order=${sourceId} requested=${reservationDelta} actual=${actualDelta} ` +
                `(pool ${reservedBefore} -> ${reservedAfter}); ` +
                `reservation ledger drift detected — needs reconciliation`
            );
          }
        }
      } catch (error) {
        // 预留越限（0099 CHECK）→ 409，订单状态转换入口据此提示
        throw normalizeInventoryWriteError(error, '库存预留越限，操作已回滚');
      }
      await this.productProjectionRefreshService.refreshByVariantIds([payload.variantId]);
    }

    const fromStatus = String(payload?.fromStatus || '').trim();
    const toStatus = String(payload?.toStatus || '').trim();
    const projectionNeedsRefresh =
      Boolean(payload?.variantId) &&
      fromStatus !== toStatus &&
      (DEMAND_ACTIVE_STATUSES.has(fromStatus) ||
        DEMAND_ACTIVE_STATUSES.has(toStatus) ||
        effect.createsDemand ||
        effect.releasesDemand);
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
