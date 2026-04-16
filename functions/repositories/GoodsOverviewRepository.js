/**
 * 订货总览仓库 (Goods Overview Repository)
 * ===================================
 *
 * 负责聚合各变体的分状态需求量，对比库存计算缺口。
 * 该库用于服务前台 /goods-overview 路由以及 AI 对全局货品的智能分析。
 */

import { buildVariantDisplayName } from '../lib/utils/variant-meta.js';
import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';

function projectInventoryGap(totalDemand, stockQuantity) {
  return (Number(totalDemand) || 0) - (Number(stockQuantity) || 0);
}

const SNAPSHOT_JOIN_SQL = `
  LEFT JOIN variant_snapshot_projection demand_snapshot
    ON demand_snapshot.variant_id = vdp.variant_id
`;

const COST_JOIN_SQL = `
  LEFT JOIN (
    SELECT
      variant_id,
      AVG(unit_cost) AS avg_unit_cost,
      AVG(allocated_freight) AS avg_freight,
      AVG(allocated_tariff) AS avg_tariff
    FROM purchase_order_items
    WHERE variant_id IS NOT NULL
    GROUP BY variant_id
  ) pc ON pc.variant_id = vdp.variant_id
`;

function buildDemandIdentitySql() {
  return `
    COALESCE(demand_snapshot.product_id, pv.product_id) AS product_id,
    MAX(p.product_code) AS product_code,
    MAX(pv.variant_code) AS variant_code,
    COALESCE(
      MAX(demand_snapshot.snapshot_name),
      MAX(p.name),
      '-'
    ) AS name,
    COALESCE(
      MAX(demand_snapshot.snapshot_sku),
      MAX(pv.sku),
      MAX(p.spu),
      '-'
    ) AS sku,
    COALESCE(
      MAX(demand_snapshot.snapshot_brand),
      MAX(p.brand),
      MAX(demand_snapshot.current_brand),
      MAX(demand_snapshot.original_brand),
      '-'
    ) AS brand,
    COALESCE(
      MAX(demand_snapshot.snapshot_category),
      MAX(p.category),
      MAX(demand_snapshot.current_category),
      MAX(demand_snapshot.original_category),
      '-'
    ) AS category
  `;
}

function buildInventorySql() {
  return `
    MAX(COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS stock_quantity,
    MAX(COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS on_hand,
    MAX(COALESCE(ib.reserved, 0)) AS reserved,
    MAX(COALESCE(ib.available, COALESCE(pv.stock_quantity, 0))) AS available,
    MAX(COALESCE(pv.alert_threshold, 10)) AS alert_threshold
  `;
}

export class GoodsOverviewRepository {
  constructor(db) {
    this.db = db;
  }

  _mapItem(row) {
    const images = parseJsonArray(row.images, []);
    const variantOptions = parseJsonObject(row.variant_options, {});

    const avgUnitCost = row.avg_unit_cost || 0;
    const avgFreight = row.avg_freight || 0;
    const avgTariff = row.avg_tariff || 0;
    const variantLabel = buildVariantDisplayName(variantOptions);

    return {
      id: row.id,
      variantId: row.id,
      productId: row.product_id,
      productCode: row.product_code || null,
      variantCode: row.variant_code || null,
      name: row.name,
      sku: row.sku,
      variantLabel,
      brand: row.brand || '',
      category: row.category || '',
      stockQuantity: row.on_hand ?? row.stock_quantity ?? 0,
      reservedQuantity: row.reserved || 0,
      availableQuantity: row.available ?? row.stock_quantity ?? 0,
      alertThreshold: row.alert_threshold ?? 10,
      images,
      confirmedQty: row.confirmed_qty,
      productionQty: row.production_qty,
      shippingQty: row.shipping_qty,
      arrivedQty: row.arrived_qty,
      totalDemand: row.total_demand,
      orderCount: row.order_count,
      orderIds: row.order_ids ? String(row.order_ids).split(',').filter(Boolean) : [],
      shortage: projectInventoryGap(row.total_demand, row.available ?? row.stock_quantity),
      avgUnitCost: Math.round(avgUnitCost * 100) / 100,
      avgFreight: Math.round(avgFreight * 100) / 100,
      avgTariff: Math.round(avgTariff * 100) / 100,
      landedCost: Math.round((avgUnitCost + avgFreight + avgTariff) * 100) / 100,
    };
  }

  async getList(filters = {}) {
    const { category, brand, shortageOnly, sort = 'shortage' } = filters;
    const bindParams = [];
    let whereClause = 'vdp.total_demand > 0';

    if (category) {
      whereClause += ` AND COALESCE(
        demand_snapshot.snapshot_category,
        p.category,
        demand_snapshot.current_category,
        demand_snapshot.original_category
      ) = ?`;
      bindParams.push(category);
    }

    if (brand) {
      whereClause += ` AND COALESCE(
        demand_snapshot.snapshot_brand,
        p.brand,
        demand_snapshot.current_brand,
        demand_snapshot.original_brand
      ) = ?`;
      bindParams.push(brand);
    }

    let orderBy;
    switch (sort) {
      case 'demand':
        orderBy = 'total_demand DESC, shortage DESC';
        break;
      case 'name':
        orderBy = 'name ASC, sku ASC';
        break;
      case 'cost':
        orderBy = '(COALESCE(pc.avg_unit_cost, 0) + COALESCE(pc.avg_freight, 0) + COALESCE(pc.avg_tariff, 0)) DESC, shortage DESC';
        break;
      case 'shortage':
      default:
        orderBy = 'shortage DESC, total_demand DESC';
        break;
    }

    const havingClause = shortageOnly ? 'HAVING shortage > 0' : 'HAVING total_demand > 0';
    const sql = `
      SELECT
        vdp.variant_id AS id,
        ${buildDemandIdentitySql()},
        ${buildInventorySql()},
        COALESCE(MAX(demand_snapshot.snapshot_specs), MAX(pv.options_values), '{}') AS variant_options,
        CASE
          WHEN MAX(demand_snapshot.snapshot_image) IS NOT NULL THEN json_array(MAX(demand_snapshot.snapshot_image))
          WHEN MAX(fv.storage_key) IS NOT NULL THEN json_array(MAX(fv.storage_key))
          ELSE MAX(p.images)
        END AS images,
        vdp.confirmed_qty,
        vdp.production_qty,
        vdp.shipping_qty,
        vdp.arrived_qty,
        vdp.total_demand,
        vdp.order_count,
        vdp.order_ids,
        vdp.total_demand - COALESCE(MAX(COALESCE(ib.available, pv.stock_quantity, 0)), 0) AS shortage,
        COALESCE(pc.avg_unit_cost, 0) AS avg_unit_cost,
        COALESCE(pc.avg_freight, 0) AS avg_freight,
        COALESCE(pc.avg_tariff, 0) AS avg_tariff
      FROM variant_demand_projection vdp
      ${SNAPSHOT_JOIN_SQL}
      LEFT JOIN product_variants pv ON pv.id = vdp.variant_id
      LEFT JOIN products p ON p.id = COALESCE(pv.product_id, demand_snapshot.product_id)
      LEFT JOIN inventory_balances ib ON ib.variant_id = vdp.variant_id
      LEFT JOIN files fv ON fv.id = pv.image_id
      ${COST_JOIN_SQL}
      WHERE ${whereClause}
      GROUP BY vdp.variant_id
      ${havingClause}
      ORDER BY ${orderBy}
    `;

    const { results } = await this.db.prepare(sql).bind(...bindParams).all();
    return (results || []).map((row) => this._mapItem(row));
  }

  async getAvailableFilters() {
    const categorySql = `
      SELECT DISTINCT COALESCE(
        demand_snapshot.snapshot_category,
        p.category,
        demand_snapshot.current_category,
        demand_snapshot.original_category
      ) as category
      FROM variant_demand_projection vdp
      ${SNAPSHOT_JOIN_SQL}
      LEFT JOIN product_variants pv ON pv.id = vdp.variant_id
      LEFT JOIN products p ON p.id = COALESCE(pv.product_id, demand_snapshot.product_id)
      WHERE vdp.total_demand > 0
        AND COALESCE(
          demand_snapshot.snapshot_category,
          p.category,
          demand_snapshot.current_category,
          demand_snapshot.original_category
        ) IS NOT NULL
        AND COALESCE(
          demand_snapshot.snapshot_category,
          p.category,
          demand_snapshot.current_category,
          demand_snapshot.original_category
        ) != ''
      ORDER BY category
    `;
    const { results: categories } = await this.db.prepare(categorySql).bind().all();

    const brandSql = `
      SELECT DISTINCT COALESCE(
        demand_snapshot.snapshot_brand,
        p.brand,
        demand_snapshot.current_brand,
        demand_snapshot.original_brand
      ) as brand
      FROM variant_demand_projection vdp
      ${SNAPSHOT_JOIN_SQL}
      LEFT JOIN product_variants pv ON pv.id = vdp.variant_id
      LEFT JOIN products p ON p.id = COALESCE(pv.product_id, demand_snapshot.product_id)
      WHERE vdp.total_demand > 0
        AND COALESCE(
          demand_snapshot.snapshot_brand,
          p.brand,
          demand_snapshot.current_brand,
          demand_snapshot.original_brand
        ) IS NOT NULL
        AND COALESCE(
          demand_snapshot.snapshot_brand,
          p.brand,
          demand_snapshot.current_brand,
          demand_snapshot.original_brand
        ) != ''
      ORDER BY brand
    `;
    const { results: brands } = await this.db.prepare(brandSql).bind().all();

    return {
      categories: (categories || []).map((row) => row.category).filter(Boolean),
      brands: (brands || []).map((row) => row.brand).filter(Boolean),
    };
  }

  async getSummary() {
    const [mainResult, shortageResult] = await Promise.all([
      this.db.prepare(`
        SELECT
          COUNT(DISTINCT CASE WHEN vdp.total_demand > 0 THEN vdp.variant_id END) AS total_products,
          COALESCE(SUM(vdp.total_demand), 0) AS total_demand,
          COUNT(DISTINCT CASE WHEN vdp.confirmed_qty > 0 THEN vdp.variant_id END) AS confirmed_products,
          COUNT(DISTINCT CASE WHEN vdp.production_qty > 0 THEN vdp.variant_id END) AS production_products,
          COUNT(DISTINCT CASE WHEN vdp.shipping_qty > 0 THEN vdp.variant_id END) AS shipping_products,
          COUNT(DISTINCT CASE WHEN vdp.arrived_qty > 0 THEN vdp.variant_id END) AS arrived_products,
          COALESCE(SUM(vdp.confirmed_qty), 0) AS confirmed_qty,
          COALESCE(SUM(vdp.production_qty), 0) AS production_qty,
          COALESCE(SUM(vdp.shipping_qty), 0) AS shipping_qty,
          COALESCE(SUM(vdp.arrived_qty), 0) AS arrived_qty,
          COALESCE(SUM(CASE WHEN vdp.confirmed_qty > 0 THEN vdp.order_count ELSE 0 END), 0) AS confirmed_orders,
          COUNT(DISTINCT CASE WHEN vdp.production_qty > 0 THEN vdp.variant_id END) AS production_orders,
          COUNT(DISTINCT CASE WHEN vdp.shipping_qty > 0 THEN vdp.variant_id END) AS shipping_orders,
          COUNT(DISTINCT CASE WHEN vdp.arrived_qty > 0 THEN vdp.variant_id END) AS arrived_orders
        FROM variant_demand_projection vdp
        WHERE vdp.total_demand > 0
      `).bind().all(),
      this.db.prepare(`
        SELECT COUNT(*) AS count FROM (
          SELECT
            vdp.variant_id,
            vdp.total_demand - COALESCE(MAX(COALESCE(ib.available, pv.stock_quantity, 0)), 0) AS shortage
          FROM variant_demand_projection vdp
          LEFT JOIN product_variants pv ON pv.id = vdp.variant_id
          LEFT JOIN inventory_balances ib ON ib.variant_id = vdp.variant_id
          WHERE vdp.total_demand > 0
          GROUP BY vdp.variant_id
          HAVING shortage > 0
        )
      `).bind().all(),
    ]);

    const row = mainResult.results?.[0] || {};

    return {
      totalProducts: row.total_products || 0,
      totalDemand: row.total_demand || 0,
      shortageCount: shortageResult.results?.[0]?.count || 0,
      byStatus: {
        confirmed: { products: row.confirmed_products || 0, count: row.confirmed_orders || 0, qty: row.confirmed_qty || 0 },
        production: { products: row.production_products || 0, count: row.production_orders || 0, qty: row.production_qty || 0 },
        shipping: { products: row.shipping_products || 0, count: row.shipping_orders || 0, qty: row.shipping_qty || 0 },
        arrived: { products: row.arrived_products || 0, count: row.arrived_orders || 0, qty: row.arrived_qty || 0 },
      },
    };
  }
}
