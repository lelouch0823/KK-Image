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
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        const [
            counts,
            recentFiles,
            fileStatusStats,
            typeStatsResult,
            topSpacesResult,
            trafficLogsResult
        ] = await Promise.all([
            this.db.prepare(
                `SELECT 
                    (SELECT COUNT(*) FROM files) as total_files,
                    (SELECT COALESCE(SUM(size), 0) FROM files) as total_size,
                    (SELECT COUNT(DISTINCT mime_type) FROM files) as type_count,
                    (SELECT COUNT(*) FROM files WHERE created_at >= ?) as today_uploads,
                    (SELECT COUNT(*) FROM folders WHERE id != "root") as folder_count,
                    (SELECT COUNT(*) FROM albums) as album_count,
                    (SELECT COUNT(*) FROM spaces) as space_count`
            ).bind(todayStart).first(),
            this.db.prepare(
                `SELECT id, name, size, mime_type as type, created_at 
                FROM files ORDER BY created_at DESC LIMIT 10`
            ).all(),
            // Status counts
            this.db.prepare(`
                SELECT status, COUNT(*) as count 
                FROM files 
                GROUP BY status
            `).all(),
            this.db.prepare(
                `SELECT 
                    mime_type as type,
                    COUNT(*) as count,
                    COALESCE(SUM(size), 0) as size
                FROM files GROUP BY mime_type ORDER BY count DESC`
            ).all(),
            this.db.prepare(
                `SELECT id, name, view_count as views, created_at 
                 FROM spaces 
                 ORDER BY view_count DESC 
                 LIMIT 5`
            ).all(),
            this.db.prepare(`
                SELECT 
                    DATE(accessed_at / 1000, 'unixepoch', '+8 hours') as date,
                    COUNT(*) as count
                FROM space_access_logs
                WHERE accessed_at >= ?
                GROUP BY date
                ORDER BY date ASC
            `).bind(thirtyDaysAgo).all()
        ]);

        const typeStats = typeStatsResult.results;
        const topSpaces = topSpacesResult.results;
        const trafficLogs = trafficLogsResult.results;

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
                total: counts?.total_files || 0,
                totalSize: counts?.total_size || 0,
                typeCount: counts?.type_count || 0,
                todayUploads: counts?.today_uploads || 0,
            },
            folders: { total: counts?.folder_count || 0 },
            albums: { total: counts?.album_count || 0 },
            spaces: { total: counts?.space_count || 0 },
            
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

    /**
     * 获取最近上传的文件
     * @param {number} limit - 返回数量
     * @returns {Promise<Object[]>}
     */
    async getRecentFiles(limit = 5) {
        const { results } = await this.db.prepare(
            `SELECT id, name, size, mime_type as type, storage_key, created_at as timestamp
             FROM files ORDER BY created_at DESC LIMIT ?`
        ).bind(limit).all();
        return results;
    }
}
