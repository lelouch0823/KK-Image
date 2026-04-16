import { inClause } from '../api/utils/sql.js';

function buildProjectionInsertSql(filterSql = '') {
  return `
    INSERT INTO variant_snapshot_projection (
      variant_id,
      product_id,
      snapshot_name,
      snapshot_sku,
      snapshot_brand,
      snapshot_category,
      current_brand,
      original_brand,
      current_category,
      original_category,
      snapshot_specs,
      snapshot_image,
      updated_at
    )
    SELECT
      ol.variant_id AS variant_id,
      MAX(ol.product_id) AS product_id,
      MAX(ol.snapshot_name) AS snapshot_name,
      MAX(ol.snapshot_sku) AS snapshot_sku,
      MAX(json_extract(ol.snapshot_specs, '$.brand')) AS snapshot_brand,
      MAX(json_extract(ol.snapshot_specs, '$.category')) AS snapshot_category,
      MAX(CASE WHEN json_valid(o.current_data) THEN json_extract(o.current_data, '$.brand') END) AS current_brand,
      MAX(CASE WHEN json_valid(o.original_data) THEN json_extract(o.original_data, '$.brand') END) AS original_brand,
      MAX(CASE WHEN json_valid(o.current_data) THEN json_extract(o.current_data, '$.category') END) AS current_category,
      MAX(CASE WHEN json_valid(o.original_data) THEN json_extract(o.original_data, '$.category') END) AS original_category,
      MAX(ol.snapshot_specs) AS snapshot_specs,
      MAX(ol.snapshot_image) AS snapshot_image,
      ?
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.variant_id IS NOT NULL${filterSql}
    GROUP BY ol.variant_id
  `;
}

export class VariantSnapshotProjectionRefreshService {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
  }

  async refreshAll() {
    const timestamp = this.now();
    await this.db.prepare('DELETE FROM variant_snapshot_projection').run();
    await this.db.prepare(buildProjectionInsertSql()).bind(timestamp).run();
  }

  async refreshByVariantIds(variantIds = []) {
    const normalizedIds = [...new Set((variantIds || []).filter(Boolean))];
    if (normalizedIds.length === 0) {
      return [];
    }

    const timestamp = this.now();
    const placeholders = inClause(normalizedIds);
    await this.db
      .prepare(`DELETE FROM variant_snapshot_projection WHERE variant_id IN ${placeholders}`)
      .bind(...normalizedIds)
      .run();
    await this.db
      .prepare(buildProjectionInsertSql(` AND ol.variant_id IN ${placeholders}`))
      .bind(timestamp, ...normalizedIds)
      .run();

    return normalizedIds;
  }

  async refreshByOrderId(orderId) {
    if (!orderId) {
      return [];
    }

    const { results } = await this.db
      .prepare(`
        SELECT DISTINCT variant_id
        FROM order_lines
        WHERE order_id = ?
          AND variant_id IS NOT NULL
      `)
      .bind(orderId)
      .all();

    return this.refreshByVariantIds((results || []).map((row) => row.variant_id).filter(Boolean));
  }
}
