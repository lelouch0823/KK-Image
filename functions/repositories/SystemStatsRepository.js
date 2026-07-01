/**
 * 系统统计仓库 (System Stats Repository)
 * ===================================
 *
 * 提供跨模块的统计数据查询，供 AI 助手使用。
 */

import { MS_PER_DAY } from '../api/utils/constants.js';

export class SystemStatsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 获取客户统计
   * @returns {Promise<Object>}
   */
  async getCustomerStats() {
    const [totalResult, recentResult] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM customers').first(),
      this.db
        .prepare(
          `SELECT COUNT(*) as count FROM customers 
           WHERE created_at >= ?`
        )
        .bind(Date.now() - 7 * MS_PER_DAY) // 最近7天
        .first(),
    ]);

    return {
      total: totalResult?.count || 0,
      recentWeek: recentResult?.count || 0,
    };
  }

  /**
   * 获取共享空间统计
   * @returns {Promise<Object>}
   */
  async getSpaceStats() {
    const [totalResult, statsResult] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM spaces').first(),
      this.db
        .prepare(
          `SELECT 
             COALESCE(SUM(view_count), 0) as totalViews,
             COALESCE(SUM(download_count), 0) as totalDownloads
           FROM spaces`
        )
        .first(),
    ]);

    const fileCountResult = await this.db
      .prepare('SELECT COUNT(*) as count FROM space_files')
      .first();

    return {
      total: totalResult?.count || 0,
      totalViews: statsResult?.totalViews || 0,
      totalDownloads: statsResult?.totalDownloads || 0,
      totalFiles: fileCountResult?.count || 0,
    };
  }

  /**
   * 获取销售人员统计
   * @returns {Promise<Object>}
   */
  async getSalespersonStats() {
    const [totalResult, activeResult, topSalesResult] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM salespersons').first(),
      this.db.prepare('SELECT COUNT(*) as count FROM salespersons WHERE is_active = 1').first(),
      this.db
        .prepare(
          `SELECT s.name, s.store, COUNT(o.id) as orderCount
           FROM salespersons s
           LEFT JOIN orders o ON s.id = o.salesperson_id AND o.archived_at IS NULL
           GROUP BY s.id
           ORDER BY orderCount DESC
           LIMIT 5`
        )
        .all(),
    ]);

    return {
      total: totalResult?.count || 0,
      active: activeResult?.count || 0,
      topPerformers: topSalesResult?.results || [],
    };
  }

  /**
   * 获取文件存储统计
   * @returns {Promise<Object>}
   */
  async getFileStats() {
    const [totalResult, sizeResult, typeResult] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM files').first(),
      this.db.prepare('SELECT COALESCE(SUM(size), 0) as totalSize FROM files').first(),
      this.db
        .prepare(
          `SELECT 
             CASE 
               WHEN mime_type LIKE 'image/%' THEN 'image'
               WHEN mime_type LIKE 'video/%' THEN 'video'
               WHEN mime_type LIKE 'audio/%' THEN 'audio'
               WHEN mime_type LIKE 'application/pdf' THEN 'pdf'
               ELSE 'other'
             END as type,
             COUNT(*) as count
           FROM files
           GROUP BY type`
        )
        .all(),
    ]);

    const typeDistribution = {};
    for (const row of typeResult?.results || []) {
      typeDistribution[row.type] = row.count;
    }

    return {
      total: totalResult?.count || 0,
      totalSizeBytes: sizeResult?.totalSize || 0,
      totalSizeMB: Math.round(((sizeResult?.totalSize || 0) / 1024 / 1024) * 100) / 100,
      typeDistribution,
    };
  }

  /**
   * 获取文件夹统计
   * @returns {Promise<Object>}
   */
  async getFolderStats() {
    const totalResult = await this.db.prepare('SELECT COUNT(*) as count FROM folders').first();

    return {
      total: totalResult?.count || 0,
    };
  }
}
