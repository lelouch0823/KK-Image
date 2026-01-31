/**
 * 文件仓库 (File Repository)
 * ===================================
 *
 * 负责文件记录 (Files) 的数据库基础操作。
 */

/** 允许更新的列名白名单 */
const ALLOWED_UPDATE_COLUMNS = new Set([
    'name', 'original_name', 'folder_id', 'storage_key',
    'size', 'mime_type', 'content_hash', 'original_hash',
    'status', 'metadata', 'tags'
]);

export class FileRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 获取文件夹下的文件列表
     * @param {string} folderId 
     * @returns {Promise<Array>}
     */
    async findByFolder(folderId) {
        const { results } = await this.db.prepare(
            'SELECT * FROM files WHERE folder_id = ? ORDER BY created_at DESC'
        ).bind(folderId).all();
        return results;
    }

    /**
     * 创建文件记录
     * @param {Object} data 
     * @returns {Promise<void>}
     */
    async create(data) {
        await this.db.prepare(
            `INSERT INTO files (
                id, folder_id, name, original_name, storage_key, 
                size, mime_type, content_hash, original_hash, created_by, 
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.id,
            data.folderId || 'root',
            data.name,
            data.originalName,
            data.storageKey,
            data.size,
            data.mimeType,
            data.contentHash,
            data.originalHash,
            data.createdBy,
            data.createdAt || Date.now(),
            data.updatedAt || Date.now()
        ).run();
    }

    /**
     * 根据 ID 获取文件记录
     * @param {string} id 
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        return await this.db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
    }

    /**
     * 根据原始哈希查询文件 (用于跨设备秒传)
     */
    async findByOriginalHash(hash) {
        return await this.db.prepare(
            'SELECT id, name, storage_key, mime_type, size FROM files WHERE original_hash = ? LIMIT 1'
        ).bind(hash).first();
    }

    /**
     * 获取文件列表（含分页）
     * @param {Object} filter
     * @param {Object} pagination
     */
    async findAll(filter = {}, { page = 1, limit = 50 } = {}) {
        // 验证分页参数
        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));

        let sql = 'SELECT * FROM files';
        const bindings = [];
        const where = [];

        if (filter.folderId) {
            where.push('folder_id = ?');
            bindings.push(filter.folderId);
        } else if (filter.rootOnly) {
            where.push("(folder_id = 'root' OR folder_id IS NULL)");
        }

        if (where.length > 0) {
            sql += ` WHERE ${where.join(' AND ')}`;
        }

        // Get total
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await this.db.prepare(countSql).bind(...bindings).first();
        const total = countResult?.total || 0;

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        bindings.push(safeLimit, (safePage - 1) * safeLimit);

        const { results } = await this.db.prepare(sql).bind(...bindings).all();

        return {
            items: results,
            total,
            page: safePage,
            limit: safeLimit,
            totalPages: Math.ceil(total / safeLimit)
        };
    }

    /**
     * 更新文件信息
     * @param {string} id
     * @param {Object} updates
     */
    async update(id, updates) {
        // 过滤只允许更新的列名（防止 SQL 注入）
        const safeKeys = Object.keys(updates).filter(k => ALLOWED_UPDATE_COLUMNS.has(k));
        if (safeKeys.length === 0) return;

        const setClause = safeKeys.map(k => `${k} = ?`).join(', ');
        const values = safeKeys.map(k => updates[k]);
        values.push(Date.now()); // updated_at
        values.push(id);

        await this.db.prepare(`UPDATE files SET ${setClause}, updated_at = ? WHERE id = ?`)
            .bind(...values)
            .run();
    }

    /**
     * 批量移动文件
     * @param {Array<string>} ids
     * @param {string} targetFolderId
     */
    async moveBatch(ids, targetFolderId) {
        const placeholders = ids.map(() => '?').join(',');
        await this.db.prepare(`UPDATE files SET folder_id = ?, updated_at = ? WHERE id IN (${placeholders})`)
            .bind(targetFolderId, Date.now(), ...ids)
            .run();
    }

    /**
     * 根据 ID 删除文件记录
     * @param {string} id
     */
    async delete(id) {
        await this.db.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
    }

    /**
     * 批量删除文件记录
     * @param {Array<string>} ids
     */
    async deleteBatch(ids) {
        if (!ids.length) return;
        const placeholders = ids.map(() => '?').join(',');
        await this.db.prepare(`DELETE FROM files WHERE id IN (${placeholders})`)
            .bind(...ids)
            .run();
    }
}
