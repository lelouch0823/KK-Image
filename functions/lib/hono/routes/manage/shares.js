import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();

/**
 * GET /api/manage/shares - 获取所有分享链接
 */
app.get('/',
    requirePermission('files:read'), // Assuming 'files:read' or admin could read shares. Ideally 'shares:read'
    async (c) => {
        const { env } = c;
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const offset = (page - 1) * limit;

        try {
            // Count total shared items
            const { total } = await env.DB.prepare(
                'SELECT COUNT(*) as total FROM folders WHERE share_token IS NOT NULL'
            ).first();

            // Fetch items
            const { results } = await env.DB.prepare(
                `SELECT * FROM folders 
                 WHERE share_token IS NOT NULL 
                 ORDER BY updated_at DESC 
                 LIMIT ? OFFSET ?`
            ).bind(limit, offset).all();

            const items = results.map(folder => ({
                id: folder.id,
                name: folder.name,
                shareToken: folder.share_token,
                shareUrl: `/gallery/${folder.share_token}`, // Constructing relative URL
                isPublic: !!folder.is_public,
                createdAt: folder.created_at,
                expiresAt: folder.share_expires_at // Added in migration
            }));

            return c.json({
                success: true,
                data: {
                    items,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (err) {
            console.error('Failed to fetch shares:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

export default app;
