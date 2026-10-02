import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { SearchRepository } from '../../../../repositories/SearchRepository.js';

const searchRoute = new Hono();

// GET /api/manage/search - 跨实体搜索
// scope: all | files | products | orders | customers（默认 files 保持向后兼容）
// 订单与客户数据比文件更敏感：viewer/user 角色持有 files:read 但不应看到
// 订单号与客户姓名/电话，orders/customers/all 范围要求订单管理权限
searchRoute.get(
  '/',
  async (c, next) => {
    const scope = c.req.query('scope') || 'files';
    const permission =
      scope === 'orders' || scope === 'customers' || scope === 'all'
        ? 'orders:manage'
        : 'files:read';
    return requirePermission(permission)(c, next);
  },
  async (c) => {
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
  }
);

export default searchRoute;
