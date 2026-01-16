/**
 * 统计仓库 (Stats Repository)
 * ===================================
 */

export class StatsRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 获取系统核心统计数据
     */
    async getGlobalStats(todayStart) {
        const [filesStats, foldersStats, albumsStats, spacesStats, recentFiles, todayStats] =
            await Promise.all([
                this.db.prepare(
                    `SELECT 
                        COUNT(*) as total,
                        COALESCE(SUM(size), 0) as total_size,
                        COUNT(DISTINCT mime_type) as type_count
                    FROM files`
                ).first(),
                this.db.prepare('SELECT COUNT(*) as total FROM folders WHERE id != "root"').first(),
                this.db.prepare('SELECT COUNT(*) as total FROM albums').first(),
                this.db.prepare('SELECT COUNT(*) as total FROM spaces').first(),
                this.db.prepare(
                    `SELECT id, name, size, mime_type, created_at 
                    FROM files ORDER BY created_at DESC LIMIT 10`
                ).all(),
                this.db.prepare('SELECT COUNT(*) as count FROM files WHERE created_at >= ?')
                    .bind(todayStart).first(),
            ]);

        const { results: typeStats } = await this.db.prepare(
            `SELECT 
                CASE 
                    WHEN mime_type LIKE 'image/%' THEN 'image'
                    WHEN mime_type LIKE 'video/%' THEN 'video'
                    WHEN mime_type LIKE 'audio/%' THEN 'audio'
                    WHEN mime_type LIKE 'application/pdf' THEN 'pdf'
                    ELSE 'other'
                END as type,
                COUNT(*) as count,
                COALESCE(SUM(size), 0) as size
            FROM files GROUP BY type`
        ).all();

        return {
            files: {
                total: filesStats?.total || 0,
                totalSize: filesStats?.total_size || 0,
                typeCount: filesStats?.type_count || 0,
                todayUploads: todayStats?.count || 0,
            },
            folders: { total: foldersStats?.total || 0 },
            albums: { total: albumsStats?.total || 0 },
            spaces: { total: spacesStats?.total || 0 },
            byType: typeStats.reduce((acc, item) => {
                acc[item.type] = { count: item.count, size: item.size };
                return acc;
            }, {}),
            recentFiles: recentFiles.results
        };
    }

    /**
     * 获取趋势统计
     */
    async getUploadTrends(startTime) {
        const { results } = await this.db.prepare(`
            SELECT 
                DATE(created_at / 1000, 'unixepoch', '+8 hours') as date,
                COUNT(*) as count,
                COALESCE(SUM(size), 0) as size
            FROM files 
            WHERE created_at >= ?
            GROUP BY date
            ORDER BY date DESC
        `).bind(startTime).all();
        return results;
    }
}
