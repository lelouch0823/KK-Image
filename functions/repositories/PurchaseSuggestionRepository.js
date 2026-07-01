/**
 * 采购建议数据访问层
 * 封装采购建议相关的 SQL 查询
 * @module repositories/PurchaseSuggestionRepository
 */

import { chunkArray } from '../lib/db/batch.js';
import { D1_MAX_IN_CLAUSE_SIZE } from '../api/utils/constants.js';

export class PurchaseSuggestionRepository {
  /** @param {D1Database} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * 查询变体详情（用于采购建议）
   * 包含变体基础信息、库存余额、建议采购价
   * @param {string[]} variantIds
   * @returns {Promise<Array>}
   */
  async findVariantDetailsForSuggestions(variantIds) {
    if (!Array.isArray(variantIds) || variantIds.length === 0) return [];

    const rows = [];
    for (const variantIdChunk of chunkArray(variantIds, D1_MAX_IN_CLAUSE_SIZE)) {
      const placeholders = variantIdChunk.map(() => '?').join(',');
      const { results } = await this.db
        .prepare(
          `
        SELECT
          pv.id AS variant_id,
          p.id AS product_id,
          p.product_code AS product_code,
          pv.variant_code AS variant_code,
          p.name AS product_name,
          pv.sku AS sku,
          p.brand,
          COALESCE(pv.cost_price, 0) AS cost_price,
          COALESCE(pv.suggested_purchase_price, 0) AS suggested_purchase_price,
          COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
          COALESCE(ib.reserved, 0) AS reserved,
          COALESCE(ib.available, COALESCE(pv.stock_quantity, 0)) AS available,
          p.images,
          pv.options_values AS variant_options
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
        WHERE pv.id IN (${placeholders})
      `
        )
        .bind(...variantIdChunk)
        .all();
      rows.push(...(results || []));
    }
    return rows;
  }

  /**
   * 查询订单快照降级数据（变体已删除时的兜底）
   * 从 order_lines + orders 中提取历史快照信息
   * @param {string[]} variantIds
   * @returns {Promise<Array>}
   */
  async findSnapshotFallbackRows(variantIds) {
    if (!Array.isArray(variantIds) || variantIds.length === 0) return [];

    const rows = [];
    for (const variantIdChunk of chunkArray(variantIds, D1_MAX_IN_CLAUSE_SIZE)) {
      const placeholders = variantIdChunk.map(() => '?').join(',');
      const { results } = await this.db
        .prepare(
          `
        SELECT
          ol.variant_id AS variant_id,
          MAX(ol.product_id) AS product_id,
          NULL AS product_code,
          NULL AS variant_code,
          COALESCE(
            MAX(ol.snapshot_name),
            MAX(json_extract(o.current_data, '$.name')),
            MAX(json_extract(o.original_data, '$.name')),
            '-'
          ) AS product_name,
          COALESCE(
            MAX(ol.snapshot_sku),
            MAX(json_extract(o.current_data, '$.sku')),
            MAX(json_extract(o.current_data, '$.variant_sku')),
            MAX(json_extract(o.current_data, '$.spu')),
            MAX(json_extract(o.original_data, '$.sku')),
            MAX(json_extract(o.original_data, '$.variant_sku')),
            MAX(json_extract(o.original_data, '$.spu')),
            '-'
          ) AS sku,
          COALESCE(
            MAX(json_extract(ol.snapshot_specs, '$.brand')),
            MAX(json_extract(o.current_data, '$.brand')),
            MAX(json_extract(o.original_data, '$.brand')),
            ''
          ) AS brand,
          0 AS cost_price,
          0 AS suggested_purchase_price,
          COALESCE(MAX(ib.on_hand), 0) AS on_hand,
          COALESCE(MAX(ib.reserved), 0) AS reserved,
          COALESCE(MAX(ib.available), 0) AS available,
          CASE
            WHEN MAX(ol.snapshot_image) IS NOT NULL THEN json_array(MAX(ol.snapshot_image))
            ELSE '[]'
          END AS images,
          COALESCE(MAX(ol.snapshot_specs), '{}') AS variant_options
        FROM order_lines ol
        JOIN orders o ON o.id = ol.order_id
        LEFT JOIN inventory_balances ib ON ib.variant_id = ol.variant_id
        WHERE ol.variant_id IN (${placeholders})
          AND o.archived_at IS NULL
          AND o.status IN ('confirmed', 'production', 'shipping', 'arrived')
        GROUP BY ol.variant_id
      `
        )
        .bind(...variantIdChunk)
        .all();
      rows.push(...(results || []));
    }
    return rows;
  }
}
