/**
 * 系统设置仓库 (Settings Repository)
 * ===================================
 *
 * 注意：SystemSettings 表的 key 是保留字，查询时需用双引号包裹。
 */

import { executeBatchChunks } from '../lib/db/batch.js';
import type { D1Database } from '../types/database.js';
import type { SettingRow, UpsertSettingData, BatchSettingData, GroupedSettings } from '../types/entities.js';

export class SettingsRepository {
  protected db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * 获取所有设置，按 category 分组返回
   * @returns 分组后的设置，无数据时返回 null
   */
  async getAllGrouped(): Promise<GroupedSettings | null> {
    const { results } = await this.db.prepare(
      'SELECT * FROM SystemSettings ORDER BY category, "key"'
    ).all<SettingRow>();

    if (!results || results.length === 0) return null;

    const grouped: GroupedSettings = {};
    results.forEach(row => {
      if (!grouped[row.category]) grouped[row.category] = {};
      grouped[row.category][row.key] = row.value;
    });
    return grouped;
  }

  /**
   * 批量 upsert 设置（使用 D1 batch）
   * @param settings 设置列表
   * @returns 影响行数
   */
  async batchUpsert(settings: BatchSettingData[]): Promise<number> {
    const stmt = this.db.prepare(
      `INSERT INTO SystemSettings ("key", "value", "category", "description", "updatedAt")
       VALUES (?, ?, ?, ?, strftime('%s', 'now'))
       ON CONFLICT("key") DO UPDATE SET
       "value" = excluded."value",
       "category" = excluded."category",
       "updatedAt" = strftime('%s', 'now')`
    );

    const batch = settings.map(s =>
      stmt.bind(s.key, s.value, s.category || 'general', s.description || null)
    );

    await executeBatchChunks(this.db, batch);
    return settings.length;
  }

  /**
   * 单个 upsert 设置
   * @param key 设置键
   * @param data 设置数据
   */
  async upsert(key: string, data: UpsertSettingData): Promise<void> {
    await this.db.prepare(
      `INSERT INTO SystemSettings ("key", "value", "category", "description", "updatedAt")
       VALUES (?, ?, ?, ?, strftime('%s', 'now'))
       ON CONFLICT("key") DO UPDATE SET
       "value" = excluded."value",
       "updatedAt" = strftime('%s', 'now')`
    ).bind(key, data.value, data.category || 'general', data.description || null).run();
  }
}
