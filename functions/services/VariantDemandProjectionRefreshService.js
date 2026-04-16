import { VariantDemandProjectionRepository } from '../repositories/VariantDemandProjectionRepository.js';

function normalizeVariantIds(variantIds = []) {
  return [...new Set(
    (Array.isArray(variantIds) ? variantIds : [])
      .map((variantId) => String(variantId || '').trim())
      .filter(Boolean)
  )];
}

export class VariantDemandProjectionRefreshService {
  constructor(db, deps = {}) {
    this.projectionRepo =
      deps.variantDemandProjectionRepo || new VariantDemandProjectionRepository(db);
  }

  async refreshByVariantIds(variantIds = []) {
    const normalizedIds = normalizeVariantIds(variantIds);
    if (normalizedIds.length === 0) return [];

    await this.projectionRepo.refreshByVariantIds(normalizedIds);
    return normalizedIds;
  }
}
