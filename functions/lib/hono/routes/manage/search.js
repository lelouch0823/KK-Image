import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';

const searchRoute = new Hono();

// GET /api/manage/search - 全文搜索
searchRoute.get('/', requirePermission('read'), async (c) => {
    const query = c.req.query('q');

    if (!query || query.trim() === '') {
        return c.json({ success: true, data: [] });
    }

    // 基础 FTS 查询，按文件名匹配
    const stmt = c.env.DB.prepare(`
      SELECT f.* 
      FROM files f
      JOIN files_fts ON f.rowid = files_fts.rowid 
      WHERE files_fts MATCH ? 
      ORDER BY rank 
      LIMIT 20
    `).bind(`"${query}"*`);

    const { results } = await stmt.all();

    return c.json({
        success: true,
        data: results
    });
});

export default searchRoute;
