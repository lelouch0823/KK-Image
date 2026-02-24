/**
 * 系统设置仓库 (Settings Repository)
 * ===================================
 *
 * 注意：SystemSettings 表的 key 是保留字，查询时需用双引号包裹。
 */

export class SettingsRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 获取所有设置，按 category 分组返回
     * @returns {Promise<Record<string, Record<string, string>> | null>}
     */
    async getAllGrouped() {
        const { results } = await this.db.prepare(
            'SELECT * FROM SystemSettings ORDER BY category, "key"'
        ).all();

        if (!results || results.length === 0) return null;

        const grouped = {};
        results.forEach(row => {
            if (!grouped[row.category]) grouped[row.category] = {};
            grouped[row.category][row.key] = row.value;
        });
        return grouped;
    }

    /**
     * 批量 upsert 设置（使用 D1 batch）
     * @param {Array<{ key: string, value: string, category?: string, description?: string }>} settings
     * @returns {Promise<number>} 影响行数
     */
    async batchUpsert(settings) {
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

        await this.db.batch(batch);
        return settings.length;
    }

    /**
     * 单个 upsert 设置
     * @param {string} key
     * @param {{ value: string, category?: string, description?: string }} data
     */
    async upsert(key, { value, category, description }) {
        await this.db.prepare(
            `INSERT INTO SystemSettings ("key", "value", "category", "description", "updatedAt")
             VALUES (?, ?, ?, ?, strftime('%s', 'now'))
             ON CONFLICT("key") DO UPDATE SET
             "value" = excluded."value",
             "updatedAt" = strftime('%s', 'now')`
        ).bind(key, value, category || 'general', description || null).run();
    }
}
