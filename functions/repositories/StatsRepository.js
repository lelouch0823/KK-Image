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
        const [
            filesStats, 
            foldersStats, 
            albumsStats, 
            spacesStats, 
            recentFiles, 
            todayStats,
            fileStatusStats
        ] = await Promise.all([
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
                `SELECT id, name, size, mime_type as type, created_at 
                FROM files ORDER BY created_at DESC LIMIT 10`
            ).all(),
            this.db.prepare('SELECT COUNT(*) as count FROM files WHERE created_at >= ?')
                .bind(todayStart).first(),
            // Status counts
            this.db.prepare(`
                SELECT status, COUNT(*) as count 
                FROM files 
                GROUP BY status
            `).all()
        ]);

        const { results: typeStats } = await this.db.prepare(
            `SELECT 
                mime_type as type,
                COUNT(*) as count,
                COALESCE(SUM(size), 0) as size
            FROM files GROUP BY mime_type ORDER BY count DESC`
        ).all();

        // Top Spaces
        const { results: topSpaces } = await this.db.prepare(
            `SELECT id, name, view_count as views, created_at 
             FROM spaces 
             ORDER BY view_count DESC 
             LIMIT 5`
        ).all();

        // Traffic (Month Logic - simplify to sum of view counts if no logs, or Logs log)
        // Since we want daily trends, we should query space_access_logs if available.
        // Assuming space_access_logs is populated:
        // Get last 30 days logs
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const { results: trafficLogs } = await this.db.prepare(`
            SELECT 
                DATE(accessed_at / 1000, 'unixepoch', '+8 hours') as date,
                COUNT(*) as count
            FROM space_access_logs
            WHERE accessed_at >= ?
            GROUP BY date
            ORDER BY date ASC
        `).bind(thirtyDaysAgo).all();

        const monthTotalTraffic = trafficLogs.reduce((acc, log) => acc + log.count, 0);
        
        // Transform status array to object
        const statusMap = { normal: 0, blocked: 0, whitelisted: 0, liked: 0 };
        if (fileStatusStats && fileStatusStats.results) {
             fileStatusStats.results.forEach(row => {
                 if (row.status) statusMap[row.status] = row.count;
             });
        }

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
            
            // For Frontend: Health & Distribution
            fileTypes: typeStats, // List for Chart
            status: statusMap,
            
            // For Frontend: Traffic
            traffic: {
                monthTotal: monthTotalTraffic,
                daily: trafficLogs.reduce((acc, log) => {
                    acc[log.date] = log.count;
                    return acc;
                }, {}),
                topSpaces: topSpaces
            },
            
            recentFiles: recentFiles.results
        };
    }

    /**
     * 获取趋势统计 (Uploads)
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
