/**
 * 订货总览仓库 (Goods Overview Repository)
 * ===================================
 *
 * 负责聚合各商品的分状态需求量，对比库存计算缺口。
 * 该库用于服务前台 /goods-overview 路由以及 AI 对全局货品的智能分析。
 */

export class GoodsOverviewRepository {
  constructor(db) {
    this.db = db;
    // 有效状态: confirmed / production / shipping / arrived
    this.ACTIVE_STATUSES = ['confirmed', 'production', 'shipping', 'arrived'];
    this.STATUS_IN_CLAUSE = this.ACTIVE_STATUSES.map(() => '?').join(',');
  }

  /**
   * 内部映射函数，处理解析和默认值
   */
  _mapItem(row) {
    let images = [];
    try {
      images = row.images ? JSON.parse(row.images) : [];
    } catch { /* ignore */ }

    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      brand: row.brand || '',
      category: row.category || '',
      stockQuantity: row.stock_quantity || 0,
      alertThreshold: row.alert_threshold || 10,
      images,
      confirmedQty: row.confirmed_qty,
      productionQty: row.production_qty,
      shippingQty: row.shipping_qty,
      arrivedQty: row.arrived_qty,
      totalDemand: row.total_demand,
      orderCount: row.order_count,
      shortage: row.shortage,
    };
  }

  /**
   * 核心列表查询
   * @param {Object} filters 筛选参数 (category, brand, shortageOnly, sort)
   */
  async getList(filters = {}) {
    const { category, brand, shortageOnly, sort = 'shortage' } = filters;

    // 构建 WHERE 子句
    let whereClause = `o.status IN (${this.STATUS_IN_CLAUSE}) AND o.product_id IS NOT NULL`;
    const bindParams = [...this.ACTIVE_STATUSES]; // 用于 IN 子句

    if (category) {
      whereClause += ' AND p.category = ?';
      bindParams.push(category);
    }
    if (brand) {
      whereClause += ` AND COALESCE(p.brand, json_extract(o.current_data, '$.brand')) = ?`;
      bindParams.push(brand);
    }

    // 排序
    let orderBy;
    switch (sort) {
      case 'demand':
        orderBy = 'total_demand DESC, shortage DESC';
        break;
      case 'name':
        orderBy = 'name ASC';
        break;
      case 'shortage':
      default:
        orderBy = 'shortage DESC, total_demand DESC';
        break;
    }

    // HAVING 子句 - 仅缺货 or 全部
    const havingClause = shortageOnly ? 'HAVING shortage > 0' : 'HAVING total_demand > 0';

    const sql = `
        SELECT 
            COALESCE(p.id, o.id) as id,
            COALESCE(p.name, json_extract(o.current_data, '$.name')) as name,
            COALESCE(p.sku, '-') as sku,
            COALESCE(p.brand, json_extract(o.current_data, '$.brand'), '-') as brand,
            COALESCE(p.category, '-') as category,
            COALESCE(p.stock_quantity, 0) as stock_quantity,
            COALESCE(p.alert_threshold, 10) as alert_threshold,
            p.images,
            COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.quantity ELSE 0 END), 0) as confirmed_qty,
            COALESCE(SUM(CASE WHEN o.status = 'production' THEN o.quantity ELSE 0 END), 0) as production_qty,
            COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN o.quantity ELSE 0 END), 0) as shipping_qty,
            COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN o.quantity ELSE 0 END), 0) as arrived_qty,
            COALESCE(SUM(o.quantity), 0) as total_demand,
            COUNT(o.id) as order_count,
            COALESCE(SUM(o.quantity), 0) - COALESCE(MAX(p.stock_quantity), 0) as shortage
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id AND p.status = 'active'
        WHERE ${whereClause}
        GROUP BY COALESCE(p.id, json_extract(o.current_data, '$.name'))
        ${havingClause}
        ORDER BY ${orderBy}
    `;

    const { results } = await this.db.prepare(sql).bind(...bindParams).all();
    return results.map(row => this._mapItem(row));
  }

  /**
   * 提取实际用到（有处于执行中订单）的分类和品牌
   */
  async getAvailableFilters() {
    const filterSql = `
        SELECT DISTINCT p.category
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.status IN (${this.STATUS_IN_CLAUSE}) 
          AND o.product_id IS NOT NULL 
          AND p.category IS NOT NULL 
          AND p.category != ''
        ORDER BY p.category
    `;
    const { results: categories } = await this.db.prepare(filterSql).bind(...this.ACTIVE_STATUSES).all();

    const brandSql = `
        SELECT DISTINCT COALESCE(p.brand, json_extract(o.current_data, '$.brand')) as brand
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        WHERE o.status IN (${this.STATUS_IN_CLAUSE}) 
          AND o.product_id IS NOT NULL 
        ORDER BY brand
    `;
    const { results: rawBrands } = await this.db.prepare(brandSql).bind(...this.ACTIVE_STATUSES).all();
    const brands = rawBrands.filter(r => r.brand && r.brand !== '-');

    return {
      categories: categories.map(r => r.category),
      brands: brands.map(r => r.brand)
    };
  }

  /**
   * 全局状态概览 (Summary)
   */
  async getSummary() {
    const { results } = await this.db.prepare(`
        SELECT 
            COUNT(DISTINCT COALESCE(p.id, json_extract(o.current_data, '$.name'))) as total_products,
            COALESCE(SUM(o.quantity), 0) as total_demand,
            -- 不同商品数
            COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN COALESCE(p.id, json_extract(o.current_data, '$.name')) END) as confirmed_products,
            COUNT(DISTINCT CASE WHEN o.status = 'production' THEN COALESCE(p.id, json_extract(o.current_data, '$.name')) END) as production_products,
            COUNT(DISTINCT CASE WHEN o.status = 'shipping'  THEN COALESCE(p.id, json_extract(o.current_data, '$.name')) END) as shipping_products,
            COUNT(DISTINCT CASE WHEN o.status = 'arrived'   THEN COALESCE(p.id, json_extract(o.current_data, '$.name')) END) as arrived_products,
            -- 件数
            COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.quantity ELSE 0 END), 0) as confirmed_qty,
            COALESCE(SUM(CASE WHEN o.status = 'production' THEN o.quantity ELSE 0 END), 0) as production_qty,
            COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN o.quantity ELSE 0 END), 0) as shipping_qty,
            COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN o.quantity ELSE 0 END), 0) as arrived_qty,
            -- 订单条数
            COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
            COUNT(CASE WHEN o.status = 'production' THEN 1 END) as production_orders,
            COUNT(CASE WHEN o.status = 'shipping' THEN 1 END) as shipping_orders,
            COUNT(CASE WHEN o.status = 'arrived' THEN 1 END) as arrived_orders
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id AND p.status = 'active'
        WHERE o.status IN (${this.STATUS_IN_CLAUSE}) AND o.product_id IS NOT NULL
    `).bind(...this.ACTIVE_STATUSES).all();

    const row = results[0] || {};

    const { results: shortageResults } = await this.db.prepare(`
        SELECT COUNT(*) as count FROM (
            SELECT COALESCE(p.id, json_extract(o.current_data, '$.name')) as id,
                COALESCE(SUM(o.quantity), 0) - COALESCE(MAX(p.stock_quantity), 0) as shortage
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id AND p.status = 'active'
            WHERE o.status IN (${this.STATUS_IN_CLAUSE}) AND o.product_id IS NOT NULL
            GROUP BY COALESCE(p.id, json_extract(o.current_data, '$.name'))
            HAVING shortage > 0
        )
    `).bind(...this.ACTIVE_STATUSES).all();

    return {
      totalProducts: row.total_products || 0,
      totalDemand: row.total_demand || 0,
      shortageCount: shortageResults[0]?.count || 0,
      byStatus: {
        confirmed: { products: row.confirmed_products || 0, count: row.confirmed_orders || 0, qty: row.confirmed_qty || 0 },
        production: { products: row.production_products || 0, count: row.production_orders || 0, qty: row.production_qty || 0 },
        shipping: { products: row.shipping_products || 0, count: row.shipping_orders || 0, qty: row.shipping_qty || 0 },
        arrived: { products: row.arrived_products || 0, count: row.arrived_orders || 0, qty: row.arrived_qty || 0 },
      },
    };
  }
}
