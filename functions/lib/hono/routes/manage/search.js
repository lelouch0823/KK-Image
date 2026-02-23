import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';

const searchRoute = new Hono();

// GET /api/manage/search - Perform full text search
searchRoute.get('/', requirePermission('read'), async (c) => {
    const query = c.req.query('q');

    if (!query || query.trim() === '') {
        return c.json({ success: true, data: [] });
    }

    try {
        // Basic FTS query matching files by name. 
        // Uses glob syntax (*) to match partial words if desired.
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
    } catch (error) {
        console.error('Search error:', error);
        return c.json({ success: false, error: 'Search failed' }, 500);
    }
});

export default searchRoute;
