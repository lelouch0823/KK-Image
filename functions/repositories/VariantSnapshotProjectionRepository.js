import { parseJsonObject } from '../api/utils/json.js';

function normalizeRow(row) {
  if (!row) return null;

  return {
    variantId: row.variant_id,
    productId: row.product_id,
    snapshotName: row.snapshot_name || null,
    snapshotSku: row.snapshot_sku || null,
    snapshotBrand: row.snapshot_brand || null,
    snapshotCategory: row.snapshot_category || null,
    currentBrand: row.current_brand || null,
    originalBrand: row.original_brand || null,
    currentCategory: row.current_category || null,
    originalCategory: row.original_category || null,
    snapshotSpecs: parseJsonObject(row.snapshot_specs, {}),
    snapshotImage: row.snapshot_image || null,
    updatedAt: row.updated_at || null,
  };
}

export class VariantSnapshotProjectionRepository {
  constructor(db) {
    this.db = db;
  }

  async listAll() {
    const { results } = await this.db
      .prepare('SELECT * FROM variant_snapshot_projection ORDER BY updated_at DESC')
      .all();

    return (results || []).map(normalizeRow);
  }
}
