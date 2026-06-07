import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { SearchRepository } from '../../../../repositories/SearchRepository.js';

const searchRoute = new Hono();

// GET /api/manage/search - 跨实体搜索
// scope: all | files | products | orders | customers（默认 files 保持向后兼容）
searchRoute.get('/', requirePermission('files:read'), async (c) => {
  const query = c.req.query('q');
  const scope = c.req.query('scope') || 'files';

  if (!query || query.trim() === '') {
    return c.json({ success: true, data: [] });
  }

  const db = c.env.DB;
  const searchRepo = new SearchRepository(db);
  let results = [];

  try {
    if (scope === 'all') {
      results = await searchRepo.searchAll(query);
    } else if (scope === 'products') {
      results = await searchRepo.searchProducts(query);
    } else if (scope === 'orders') {
      results = await searchRepo.searchOrders(query);
    } else if (scope === 'customers') {
      results = await searchRepo.searchCustomers(query);
    } else {
      // 默认搜索文件（向后兼容）
      results = await searchRepo.searchFiles(query);
    }
  } catch (err) {
    console.error('[search] 搜索失败:', err);
  }

  return c.json({
    success: true,
    data: results,
  });
});

export default searchRoute;
