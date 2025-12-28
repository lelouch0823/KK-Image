import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { MSG } from '../../../../api/utils/messages.js';

const app = new Hono();

/**
 * GET /api/manage/stats - 获取系统统计信息
 */
app.get('/',
    requirePermission('stats:read'),
    withCache(60),
    async (c) => {
        const { env } = c;

        try {
            // 并行获取所有统计数据
            const [
                filesStats,
                foldersStats,
                albumsStats,
                spacesStats,
                recentFiles
            ] = await Promise.all([
                env.DB.prepare(`
          SELECT 
            COUNT(*) as total,
            COALESCE(SUM(size), 0) as total_size,
            COUNT(DISTINCT mime_type) as type_count
          FROM files
        `).first(),
                env.DB.prepare('SELECT COUNT(*) as total FROM folders WHERE id != "root"').first(),
                env.DB.prepare(`
          SELECT COUNT(*) as total FROM albums
        `).first(),
                env.DB.prepare(`
          SELECT COUNT(*) as total FROM spaces
        `).first(),
                env.DB.prepare(`
          SELECT id, name, size, mime_type, created_at 
          FROM files ORDER BY created_at DESC LIMIT 10
        `).all()
            ]);

            // 获取按类型分组的统计
            const { results: typeStats } = await env.DB.prepare(`
        SELECT 
          CASE 
            WHEN mime_type LIKE 'image/%' THEN 'image'
            WHEN mime_type LIKE 'video/%' THEN 'video'
            WHEN mime_type LIKE 'audio/%' THEN 'audio'
            WHEN mime_type LIKE 'application/pdf' THEN 'pdf'
            ELSE 'other'
          END as type,
          COUNT(*) as count,
          COALESCE(SUM(size), 0) as size
        FROM files GROUP BY type
      `).all();

            // 获取存储使用情况
            let storageInfo = { used: 0, limit: null };
            if (env.R2_BUCKET) {
                // R2 不提供直接的使用量 API，使用数据库统计
                storageInfo.used = filesStats?.total_size || 0;
            }

            return c.json({
                success: true,
                data: {
                    files: {
                        total: filesStats?.total || 0,
                        totalSize: filesStats?.total_size || 0,
                        typeCount: filesStats?.type_count || 0
                    },
                    folders: {
                        total: foldersStats?.total || 0
                    },
                    albums: {
                        total: albumsStats?.total || 0
                    },
                    spaces: {
                        total: spacesStats?.total || 0
                    },
                    byType: typeStats.reduce((acc, item) => {
                        acc[item.type] = { count: item.count, size: item.size };
                        return acc;
                    }, {}),
                    storage: storageInfo,
                    recentFiles: recentFiles.results.map(f => ({
                        id: f.id,
                        name: f.name,
                        size: f.size,
                        mimeType: f.mime_type,
                        createdAt: f.created_at
                    })),
                    generatedAt: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * GET /api/manage/stats/uploads - 上传统计（按日期）
 */
app.get('/uploads',
    requirePermission('stats:read'),
    async (c) => {
        const { env } = c;
        const days = parseInt(c.req.query('days') || '30');

        try {
            const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

            const { results } = await env.DB.prepare(`
        SELECT 
          DATE(created_at / 1000, 'unixepoch') as date,
          COUNT(*) as count,
          COALESCE(SUM(size), 0) as size
        FROM files 
        WHERE created_at >= ?
        GROUP BY date
        ORDER BY date DESC
      `).bind(startTime).all();

            return c.json({
                success: true,
                data: {
                    period: days,
                    uploads: results
                }
            });
        } catch (err) {
            console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
        }
    }
);

export default app;
