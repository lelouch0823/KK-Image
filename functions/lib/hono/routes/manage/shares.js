import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { withCache } from '../../middleware/cache.js';
import { parsePagination } from '../../_shared/route-helpers.js';

const app = new Hono();

/**
 * GET /api/manage/shares - 获取所有分享链接
 */
app.get('/', requirePermission('files:read'), withCache(30), async (c) => {
  const { env } = c;
  const { page, limit } = parsePagination(c);

  const repo = new FolderRepository(env.DB);
  const result = await repo.findShared({ page, limit });

  const items = result.items.map((folder) => ({
    id: folder.id,
    name: folder.name,
    shareToken: folder.share_token,
    shareUrl: `/gallery/${folder.share_token}`,
    isPublic: !!folder.is_public,
    createdAt: folder.created_at,
    expiresAt: folder.share_expires_at,
  }));

  return c.json({
    success: true,
    data: items,
    pagination: {
      page: result.page,
      limit: result.limit || limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
});

export default app;
