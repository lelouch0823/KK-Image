import { generateId } from '../api/utils/id.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { BadRequestError } from '../lib/hono/errors.js';
import {
  appendInventoryLedgerEvent,
  projectInventoryBalances,
} from './InventoryProjectionService.js';

const VALID_MUTATION_TYPES = new Set([
  'purchase_received',
  'purchase_arrival',
  'manual_adjustment',
  'order_shipment',
  'inventory_reserved',
  'reservation_hold',
  'inventory_released',
  'reservation_release',
]);
export { appendInventoryLedgerEvent, projectInventoryBalances };

export class InventoryService {
  constructor(db, variantRepo = new ProductVariantRepository(db)) {
    this.db = db;
    this.variantRepo = variantRepo;
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

  async applyMutation(payload = {}) {
    const mutation = this.validateMutation(payload);
    if (typeof this.db?.prepare === 'function') {
      const timestamp = Date.now();
      await this.db.prepare(
        `UPDATE product_variants
         SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ?
         WHERE id = ?`
      ).bind(mutation.quantityDelta, timestamp, mutation.variantId).run();

      await this.db.prepare(
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
      ).run();

      await this.db.prepare(
        `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        mutation.variantId,
        mutation.type,
        mutation.quantityDelta,
        payload.referenceType || 'inventory_service',
        payload.referenceId || mutation.variantId,
        timestamp,
        JSON.stringify(payload.metadata || {}),
        timestamp
      ).run();
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

    for (const mutation of mutations) {
      await this.applyMutation(mutation);
    }

    return {
      productCount: mutations.length,
      totalQty: mutations.reduce((sum, mutation) => sum + Math.abs(Number(mutation.quantityDelta) || 0), 0),
    };
  }
}
