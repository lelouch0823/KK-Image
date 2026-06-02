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
 * 检查 FTS5 虚拟表是否存在（带缓存，5 分钟 TTL）
 */
const FTS_CACHE_TTL_MS = 5 * 60 * 1000;
const _ftsCache = { products: null, orders: null, _timestamp: 0 };

async function hasFtsTable(db, tableName) {
    const now = Date.now();
    if (now - _ftsCache._timestamp > FTS_CACHE_TTL_MS) {
        // TTL 过期，重置缓存
        _ftsCache.products = null;
        _ftsCache.orders = null;
        _ftsCache._timestamp = now;
    }
    if (_ftsCache[tableName] !== null) return _ftsCache[tableName];
    try {
        const result = await db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        ).bind(tableName).first();
        _ftsCache[tableName] = !!result;
    } catch {
        _ftsCache[tableName] = false;
    }
    return _ftsCache[tableName];
}

/**
 * 搜索商品（FTS5 全文搜索，降级为 LIKE）
 */
async function searchProducts(db, query) {
    const hasFts = await hasFtsTable(db, 'products_fts');
    if (hasFts) {
        const sanitized = sanitizeFts5Query(query);
        if (sanitized) {
            const stmt = db.prepare(`
              SELECT p.id, p.name, p.spu, p.created_at,
                     'product' AS result_type
              FROM products p
              JOIN products_fts ON p.rowid = products_fts.rowid
              WHERE products_fts MATCH ?
              ORDER BY rank
              LIMIT 10
            `).bind(`"${sanitized}"*`);
            const { results } = await stmt.all();
            return results;
        }
    }

    // 降级为 LIKE
    const pattern = `%${query}%`;
    const stmt = db.prepare(`
      SELECT id, name, spu, created_at,
             'product' AS result_type
      FROM products
      WHERE name LIKE ? OR spu LIKE ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(pattern, pattern);

    const { results } = await stmt.all();
    return results;
}

/**
 * 搜索订单（FTS5 全文搜索，降级为 LIKE）
 */
async function searchOrders(db, query) {
    const hasFts = await hasFtsTable(db, 'orders_fts');
    if (hasFts) {
        const sanitized = sanitizeFts5Query(query);
        if (sanitized) {
            const stmt = db.prepare(`
              SELECT o.id, o.order_no, o.status, o.created_at,
                     c.name AS customer_name,
                     'order' AS result_type
              FROM orders o
              LEFT JOIN customers c ON o.customer_id = c.id
              WHERE o.rowid IN (SELECT rowid FROM orders_fts WHERE orders_fts MATCH ?)
              ORDER BY o.created_at DESC
              LIMIT 10
            `).bind(`"${sanitized}"*`);
            const { results } = await stmt.all();
            return results;
        }
    }

    // 降级为 LIKE
    const pattern = `%${query}%`;
    const stmt = db.prepare(`
      SELECT o.id, o.order_no, o.status, o.created_at,
             c.name AS customer_name,
             'order' AS result_type
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.order_no LIKE ? OR o.summary_name LIKE ?
      ORDER BY o.created_at DESC
      LIMIT 10
    `).bind(pattern, pattern);

    const { results } = await stmt.all();
    return results;
}

/**
 * 搜索客户（FTS5 全文搜索，降级为 LIKE）
 */
async function searchCustomers(db, query) {
    const hasFts = await hasFtsTable(db, 'customers_fts');
    if (hasFts) {
        const sanitized = sanitizeFts5Query(query);
        if (sanitized) {
            const stmt = db.prepare(`
              SELECT c.id, c.name, c.phone, c.created_at,
                     'customer' AS result_type
              FROM customers c
              JOIN customers_fts ON c.rowid = customers_fts.rowid
              WHERE customers_fts MATCH ?
              ORDER BY rank
              LIMIT 10
            `).bind(`"${sanitized}"*`);
            const { results } = await stmt.all();
            return results;
        }
    }

    // 降级为 LIKE
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
