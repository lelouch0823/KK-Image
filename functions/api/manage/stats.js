/**
 * 管理端统计 API (SOTA)
 * GET /api/manage/stats
 * 
 * 提供文件资产深度分析：
 * - 存储分析 (总量、增长趋势)
 * - 访问统计 (空间访问趋势、热门空间)
 * - 资产健康度 (状态分布、文件类型)
 */

import { success, error } from '../utils/response.js';
import { authenticateAdmin } from '../utils/auth.js';
import { MSG } from '../utils/messages.js';

export async function onRequestGet(context) {
    const { env, request } = context;

    try {
        // 1. 鉴权
        await authenticateAdmin(request, env);

        // 2. 准备时间参数
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        const db = env.DB;

        // 3. 构建 DB Batch 查询 (SOTA: 最小化重复，聚焦资产分析)
        const batch = [
            // 0: 文件总数和总存储量
            db.prepare('SELECT COUNT(*) as count, SUM(size) as totalSize FROM files'),

            // 1: 文件类型分布 (Top 6)
            db.prepare(`
        SELECT mime_type as type, COUNT(*) as count 
        FROM files 
        GROUP BY mime_type 
        ORDER BY count DESC 
        LIMIT 6
      `),

            // 2: 文件状态分布
            db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM files 
        GROUP BY status
      `),

            // 3: 30天访问趋势 (来自 space_access_logs)
            db.prepare(`
        SELECT (accessed_at / 86400000) as day, COUNT(*) as count 
        FROM space_access_logs 
        WHERE accessed_at >= ? 
        GROUP BY day 
        ORDER BY day ASC
      `).bind(thirtyDaysAgo),

            // 4: 热门空间 Top 5 (按访问量)
            db.prepare(`
        SELECT s.id, s.name, s.view_count as views, s.download_count as downloads
        FROM spaces s
        WHERE s.is_public = 1
        ORDER BY s.view_count DESC
        LIMIT 5
      `),

            // 5: 本月访问总量
            db.prepare(`
        SELECT COUNT(*) as count 
        FROM space_access_logs 
        WHERE accessed_at >= ?
      `).bind(thirtyDaysAgo),

            // 6: 大文件 Top 10
            db.prepare(`
        SELECT id, name, size, mime_type as type 
        FROM files 
        ORDER BY size DESC 
        LIMIT 10
      `),

            // 7: 30天存储增长趋势 (累计)
            db.prepare(`
        SELECT (created_at / 86400000) as day, SUM(size) as size 
        FROM files 
        WHERE created_at >= ? 
        GROUP BY day 
        ORDER BY day ASC
      `).bind(thirtyDaysAgo),
        ];

        // 4. 执行查询
        const results = await db.batch(batch);

        // 5. 数据处理
        const totalStats = results[0].results[0] || { count: 0, totalSize: 0 };
        const typesRows = results[1].results || [];
        const statusRows = results[2].results || [];
        const accessTrendRows = results[3].results || [];
        const topSpacesRows = results[4].results || [];
        const monthAccessStats = results[5].results[0] || { count: 0 };
        const largeFilesRows = results[6].results || [];
        const storageTrendRows = results[7].results || [];

        // 处理访问趋势数据
        const accessDaily = {};
        accessTrendRows.forEach(row => {
            const date = new Date(row.day * 86400000);
            const key = date.toISOString().split('T')[0];
            accessDaily[key] = row.count;
        });

        // 补全最近30天
        for (let i = 0; i < 30; i++) {
            const d = new Date(now - i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().split('T')[0];
            if (!accessDaily[key]) accessDaily[key] = 0;
        }

        // 按日期排序
        const sortedAccessDaily = Object.keys(accessDaily).sort().reduce((obj, key) => {
            obj[key] = accessDaily[key];
            return obj;
        }, {});

        // 处理存储增长趋势 (累计)
        const storageGrowth = {};
        let cumulativeSize = 0;
        storageTrendRows.forEach(row => {
            cumulativeSize += row.size || 0;
            const date = new Date(row.day * 86400000);
            const key = date.toISOString().split('T')[0];
            storageGrowth[key] = cumulativeSize;
        });

        // 处理 MIME 类型
        const formattedTypes = typesRows.map(row => ({
            type: row.type ? row.type.split('/')[1] || row.type : 'unknown',
            count: row.count
        }));

        // 处理状态统计
        const statusMap = { normal: 0, blocked: 0, whitelisted: 0, liked: 0 };
        statusRows.forEach(row => {
            if (row.status && row.status in statusMap) {
                statusMap[row.status] = row.count;
            }
        });

        // 6. 构造 SOTA 响应
        const data = {
            // 存储分析
            storage: {
                totalFiles: totalStats.count || 0,
                totalSize: totalStats.totalSize || 0,
                growthTrend: storageGrowth,
                largeFiles: largeFilesRows
            },
            // 访问统计
            traffic: {
                monthTotal: monthAccessStats.count || 0,
                daily: sortedAccessDaily,
                topSpaces: topSpacesRows
            },
            // 资产健康度
            health: {
                status: statusMap,
                fileTypes: formattedTypes
            }
        };

        return success(data);

    } catch (err) {
        console.error('Stats API Error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`);
    }
}
