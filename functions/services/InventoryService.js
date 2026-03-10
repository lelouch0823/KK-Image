import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { BadRequestError } from '../lib/hono/errors.js';

const VALID_MUTATION_TYPES = new Set([
  'purchase_arrival',
  'manual_adjustment',
  'order_shipment',
  'reservation_release',
]);

export class InventoryService {
  constructor(db, variantRepo = new ProductVariantRepository(db)) {
    this.db = db;
    this.variantRepo = variantRepo;
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
    await this.variantRepo.adjustStock(mutation.variantId, mutation.quantityDelta);
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
