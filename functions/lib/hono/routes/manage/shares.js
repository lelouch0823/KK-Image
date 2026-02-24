import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';

const app = new Hono();

/**
 * GET /api/manage/shares - 获取所有分享链接
 */
app.get(
  '/',
  requirePermission('files:read'),
  async (c) => {
    const { env } = c;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');

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
      data: {
        items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  }
);

export default app;
