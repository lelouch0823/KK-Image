import { generateId } from '../api/utils/id.js';
import { executeBatchChunks } from '../lib/db/batch.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { BadRequestError } from '../lib/hono/errors.js';
import {
  appendInventoryLedgerEvent,
  projectInventoryBalances,
} from './InventoryProjectionService.js';
import { queryOrderLineCandidates } from './order-line-shared.js';

const VALID_MUTATION_TYPES = new Set([
  'purchase_received',
  'purchase_arrival',
  'inventory_adjusted_reversal',
  'manual_adjustment',
  'order_shipment',
  'order_unshipment',
  'order_return_restock',
]);
export { appendInventoryLedgerEvent, projectInventoryBalances };

export class InventoryService {
  constructor(db, variantRepo = new ProductVariantRepository(db)) {
    this.db = db;
    this.variantRepo = variantRepo;
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

  async getOnHand(variantId) {
    if (!variantId) return 0;
    const variant = typeof this.variantRepo.findById === 'function'
      ? await this.variantRepo.findById(variantId)
      : null;
    return Math.max(0, Number(variant?.stock_quantity) || 0);
  }

  async assertSufficient(variantId, requiredQty) {
    const safeRequiredQty = Math.max(0, Number(requiredQty) || 0);
    if (!variantId || safeRequiredQty <= 0) return true;

    const onHand = await this.getOnHand(variantId);
    if (onHand < safeRequiredQty) {
      throw new Error('insufficient variant stock for delivery');
    }
    return true;
  }

  validateMutation(payload = {}) {
    const type = String(payload.type || '').trim();
    const variantId = String(payload.variantId || '').trim();
    const quantityDelta = Number(payload.quantityDelta);

    if (!VALID_MUTATION_TYPES.has(type)) {
      throw new BadRequestError('Invalid inventory mutation type');
    }
    if (!variantId) {
      throw new BadRequestError('variantId is required');
    }
    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
      throw new BadRequestError('quantityDelta must be a non-zero number');
    }

    return { type, variantId, quantityDelta };
  }

  async buildMutationStatements(payload = {}) {
    const mutation = this.validateMutation(payload);
    const timestamp = Date.now();
    const orderLineId = await this.resolveOrderLineId(payload);
    const purchaseReceiptId = payload.purchaseReceiptId || null;
    const sourceType = payload.referenceType || 'inventory_service';
    const sourceId = payload.referenceId || mutation.variantId;
    const ledgerId = generateId();
    const inventoryEventId = generateId();

    return {
      mutation,
      orderLineId,
      purchaseReceiptId,
      sourceType,
      sourceId,
      ledgerId,
      inventoryEventId,
      timestamp,
      statements: [
        this.db.prepare(
          `UPDATE product_variants
           SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ?
           WHERE id = ?`
        ).bind(mutation.quantityDelta, timestamp, mutation.variantId),
        this.db.prepare(
          `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
           VALUES (?, ?, 0, ?, ?)
           ON CONFLICT(variant_id) DO UPDATE SET
             on_hand = MAX(0, inventory_balances.on_hand + ?),
             available = MAX(0, MAX(0, inventory_balances.on_hand + ?) - inventory_balances.reserved),
             updated_at = excluded.updated_at`
        ).bind(
          mutation.variantId,
          Math.max(mutation.quantityDelta, 0),
          Math.max(mutation.quantityDelta, 0),
          timestamp,
          mutation.quantityDelta,
          mutation.quantityDelta
        ),
        this.db.prepare(
          `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          ledgerId,
          mutation.variantId,
          mutation.type,
          mutation.quantityDelta,
          sourceType,
          sourceId,
          timestamp,
          JSON.stringify(payload.metadata || {}),
          timestamp
        ),
        this.db.prepare(
          `INSERT INTO inventory_events (
            id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta,
            source_type, source_id, metadata, occurred_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          inventoryEventId,
          mutation.variantId,
          orderLineId,
          purchaseReceiptId,
          mutation.type,
          mutation.quantityDelta,
          sourceType,
          sourceId,
          JSON.stringify(payload.metadata || {}),
          timestamp,
          timestamp
        ),
      ],
    };
  }

  async applyMutation(payload = {}) {
    const mutation = this.validateMutation(payload);
    if (typeof this.db?.prepare === 'function') {
      const { statements } = await this.buildMutationStatements(payload);
      await this.db.batch(statements);
    } else if (typeof this.variantRepo?.adjustStock === 'function') {
      await this.variantRepo.adjustStock(mutation.variantId, mutation.quantityDelta);
    } else {
      throw new Error('InventoryService requires a DB handle or variant repository adjustStock implementation');
    }
    return mutation;
  }

  async applyBatch(mutations = []) {
    if (!Array.isArray(mutations) || mutations.length === 0) {
      return { productCount: 0, totalQty: 0 };
    }

    if (typeof this.db?.prepare === 'function' && typeof this.db?.batch === 'function') {
      const statements = [];
      for (const mutation of mutations) {
        const built = await this.buildMutationStatements(mutation);
        statements.push(...built.statements);
      }
      await executeBatchChunks(this.db, statements);
    } else {
      for (const mutation of mutations) {
        await this.applyMutation(mutation);
      }
    }

    return {
      productCount: mutations.length,
      totalQty: mutations.reduce((sum, mutation) => sum + Math.abs(Number(mutation.quantityDelta) || 0), 0),
    };
  }
}
