import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';

const searchRoute = new Hono();

/**
 * 转义 FTS5 特殊字符，防止 MATCH 注入
 * FTS5 特殊字符: " * ( ) ^ - + : OR AND NOT NEAR
 */
function sanitizeFts5Query(input) {
    const sanitized = String(input || '')
        .replace(/["*()\-+:]/g, ' ')  // 替换特殊字符为空格
        .replace(/\b(OR|AND|NOT|NEAR)\b/gi, ' ')  // 移除布尔操作符
        .replace(/\s+/g, ' ')  // 合并连续空格
        .trim();
    return sanitized;
}

/**
 * 搜索文件（FTS5 全文搜索）
 */
async function searchFiles(db, query) {
    const sanitized = sanitizeFts5Query(query);
    if (!sanitized) return [];

    const stmt = db.prepare(`
      SELECT f.id, f.name, f.path, f.type, f.size, f.created_at,
             'file' AS result_type
      FROM files f
      JOIN files_fts ON f.rowid = files_fts.rowid
      WHERE files_fts MATCH ?
      ORDER BY rank
      LIMIT 10
    `).bind(`"${sanitized}"*`);

    const { results } = await stmt.all();
    return results;
}

/**
 * 搜索商品（LIKE 模糊匹配）
 */
async function searchProducts(db, query) {
    const pattern = `%${query}%`;
    const stmt = db.prepare(`
      SELECT id, name, sku, status, created_at,
             'product' AS result_type
      FROM products
      WHERE name LIKE ? OR sku LIKE ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(pattern, pattern);

    const { results } = await stmt.all();
    return results;
}

/**
 * 搜索订单（LIKE 模糊匹配）
 */
async function searchOrders(db, query) {
    const pattern = `%${query}%`;
    const stmt = db.prepare(`
      SELECT o.id, o.order_no, o.status, o.created_at, o.customer_name,
             'order' AS result_type
      FROM orders o
      WHERE o.order_no LIKE ? OR o.customer_name LIKE ?
      ORDER BY o.created_at DESC
      LIMIT 10
    `).bind(pattern, pattern);

    const { results } = await stmt.all();
    return results;
}

/**
 * 搜索客户（LIKE 模糊匹配）
 */
async function searchCustomers(db, query) {
    const pattern = `%${query}%`;
    const stmt = db.prepare(`
      SELECT id, name, phone, created_at,
             'customer' AS result_type
      FROM customers
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(pattern, pattern);

    const { results } = await stmt.all();
    return results;
}

// GET /api/manage/search - 跨实体搜索
// scope: all | files | products | orders | customers（默认 files 保持向后兼容）
searchRoute.get('/', requirePermission('files:read'), async (c) => {
    const query = c.req.query('q');
    const scope = c.req.query('scope') || 'files';

    if (!query || query.trim() === '') {
        return c.json({ success: true, data: [] });
    }

    const db = c.env.DB;
    let results = [];

    try {
        if (scope === 'all') {
            // 并行搜索所有实体
            const [files, products, orders, customers] = await Promise.all([
                searchFiles(db, query),
                searchProducts(db, query),
                searchOrders(db, query),
                searchCustomers(db, query),
            ]);
            results = [...files, ...products, ...orders, ...customers];
        } else if (scope === 'products') {
            results = await searchProducts(db, query);
        } else if (scope === 'orders') {
            results = await searchOrders(db, query);
        } else if (scope === 'customers') {
            results = await searchCustomers(db, query);
        } else {
            // 默认搜索文件（向后兼容）
            results = await searchFiles(db, query);
        }
    } catch (err) {
        console.error('[search] 搜索失败:', err);
        // 降级：如果 FTS 失败，回退到 LIKE 搜索文件
        if (scope === 'files' || scope === 'all') {
            try {
                const pattern = `%${query}%`;
                const fallback = await db.prepare(`
                  SELECT id, name, path, type, size, created_at,
                         'file' AS result_type
                  FROM files
                  WHERE name LIKE ?
                  ORDER BY created_at DESC
                  LIMIT 10
                `).bind(pattern).all();
                if (scope === 'files') {
                    results = fallback.results;
                } else {
                    results = [...fallback.results, ...results];
                }
            } catch (_fallbackErr) {
                // 降级也失败，返回已有结果
            }
        }
    }

    return c.json({
        success: true,
        data: results
    });
});

export default searchRoute;
