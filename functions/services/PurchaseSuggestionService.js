/**
 * 采购建议服务 (Purchase Suggestion Service)
 * =========================================
 *
 * 基于订货总览缺口推荐待采购商品：
 * - 从 demand projection 获取短缺变体
 * - 查询变体库存和定价信息
 * - 对缺失变体使用订单快照降级查询
 *
 * @module services/PurchaseSuggestionService
 */

import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';
import { PurchaseSuggestionRepository } from '../repositories/PurchaseSuggestionRepository.js';
import { buildVariantDisplayName } from '../lib/utils/variant-meta.js';

function resolveInventorySnapshot(row = {}) {
  const onHand = Number(row.on_hand ?? row.stock_quantity ?? 0) || 0;
  const reserved = Number(row.reserved ?? 0) || 0;
  const available = Number(row.available ?? Math.max(onHand - reserved, 0)) || 0;

  return { onHand, reserved, available };
}

function buildSuggestionPricing(row, lastPurchasePriceMap) {
  const variantCostPrice = Number(row.cost_price) || 0;
  const rawSuggested = Number(row.suggested_purchase_price) || 0;
  const suggestedPurchasePrice = rawSuggested > 0 ? rawSuggested : variantCostPrice;
  const hasLastPrice = Object.prototype.hasOwnProperty.call(lastPurchasePriceMap, row.variant_id);
  const lastPurchasePrice = hasLastPrice ? lastPurchasePriceMap[row.variant_id] : null;
  const priceDelta =
    lastPurchasePrice == null
      ? null
      : Math.round((suggestedPurchasePrice - lastPurchasePrice) * 100) / 100;

  return {
    variant_cost_price: variantCostPrice,
    suggested_purchase_price: suggestedPurchasePrice,
    last_purchase_price: lastPurchasePrice,
    price_delta: priceDelta,
  };
}

export class PurchaseSuggestionService {
  /**
   * @param {D1Database} db
   * @param {Object} deps - 依赖注入
   * @param {import('../repositories/VariantDemandProjectionRepository.js').VariantDemandProjectionRepository} deps.demandProjectionRepo
   * @param {import('../repositories/PurchaseOrderRepository.js').PurchaseOrderRepository} deps.repo
   * @param {import('../repositories/PurchaseSuggestionRepository.js').PurchaseSuggestionRepository} [deps.suggestionRepo]
   */
  constructor(db, deps = {}) {
    this.db = db;
    this.demandProjectionRepo = deps.demandProjectionRepo;
    this.repo = deps.repo;
    this.suggestionRepo = deps.suggestionRepo || new PurchaseSuggestionRepository(db);
  }

  /**
   * 获取建议采购清单
   * 基于订货总览中 shortage > 0 的变体，以及 status = 'confirmed' 的预订单
   *
   * @returns {Promise<Array>} 建议列表
   */
  async getSuggestions() {
    const demandRows = await this.demandProjectionRepo.listAll();
    const variantIds = demandRows.map((row) => row.variant_id).filter(Boolean);
    if (variantIds.length === 0) {
      return [];
    }

    const rows = await this.suggestionRepo.findVariantDetailsForSuggestions(variantIds);

    const liveVariantIdSet = new Set(rows.map((row) => row.variant_id).filter(Boolean));
    const missingVariantIds = variantIds.filter((variantId) => !liveVariantIdSet.has(variantId));
    if (missingVariantIds.length > 0) {
      rows.push(...(await this.suggestionRepo.findSnapshotFallbackRows(missingVariantIds)));
    }

    const demandByVariant = new Map(demandRows.map((row) => [row.variant_id, row]));
    const lastPurchasePriceMap = await this.repo.getLastPurchasePricesByVariant(variantIds);

    return rows
      .map((row) => {
        const demand = demandByVariant.get(row.variant_id) || {
          total_demand: 0,
          order_count: 0,
          order_ids: [],
        };
        const totalDemand = Number(demand.total_demand || 0);
        const { onHand, available } = resolveInventorySnapshot(row);
        const shortage = Math.max(totalDemand - available, 0);
        return {
          ...buildSuggestionPricing(row, lastPurchasePriceMap),
          variant_id: row.variant_id,
          product_id: row.product_id,
          product_code: row.product_code,
          variant_code: row.variant_code,
          product_name: row.product_name,
          sku: row.sku,
          brand: row.brand,
          cost_price: Number(row.cost_price) || 0,
          stock_quantity: onHand,
          available_quantity: available,
          total_demand: totalDemand,
          shortage,
          order_count: Number(demand.order_count || 0),
          order_ids: Array.isArray(demand.order_ids) ? demand.order_ids : [],
          images: parseJsonArray(row.images, []),
          variant_options: parseJsonObject(row.variant_options, {}),
          variant_display_name: buildVariantDisplayName(parseJsonObject(row.variant_options, {})),
        };
      })
      .filter((row) => row.shortage > 0)
      .sort((a, b) => b.shortage - a.shortage);
  }
}
