import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';

const searchRoute = new Hono();

/**
 * 转义 FTS5 特殊字符，防止 MATCH 注入
 * FTS5 特殊字符: " * ( ) ^ - + : OR AND NOT NEAR
 */
function sanitizeFts5Query(input) {
    const sanitized = String(input || '')
        .replace(/["*^()\-+:]/g, ' ')  // 替换特殊字符为空格
        .replace(/\b(OR|AND|NOT|NEAR)\b/gi, ' ')  // 移除布尔操作符
        .replace(/\s+/g, ' ')  // 合并连续空格
        .trim();
    return sanitized;
}

// GET /api/manage/search - 全文搜索
searchRoute.get('/', requirePermission('files:read'), async (c) => {
    const query = c.req.query('q');

    if (!query || query.trim() === '') {
        return c.json({ success: true, data: [] });
    }

    // 转义 FTS5 特殊字符后构建安全的 MATCH 表达式
    const sanitized = sanitizeFts5Query(query);
    if (!sanitized) {
        return c.json({ success: true, data: [] });
    }

    const stmt = c.env.DB.prepare(`
      SELECT f.*
      FROM files f
      JOIN files_fts ON f.rowid = files_fts.rowid
      WHERE files_fts MATCH ?
      ORDER BY rank
      LIMIT 20
    `).bind(`"${sanitized}"*`);

    const { results } = await stmt.all();

    return c.json({
        success: true,
        data: results
    });
});

export default searchRoute;
