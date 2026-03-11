/**
 * 文件仓库 (File Repository)
 * ===================================
 *
 * 负责文件记录 (Files) 的数据库基础操作。
 */
import { inClause } from '../api/utils/sql.js';
import { parseRepoPagination } from '../api/utils/pagination.js';

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
            "SELECT * FROM files WHERE folder_id = ? AND is_deleted = 0 ORDER BY created_at DESC"
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
                created_at, updated_at, is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
        ).bind(
            data.id,
            data.folderId || 'root',
            data.name || 'unnamed',
            data.originalName || data.name || 'unnamed',
            data.storageKey,
            data.size || 0,
            data.mimeType || 'application/octet-stream',
            data.contentHash || null,
            data.originalHash || null,
            data.createdBy || null,
            data.createdAt || Date.now(),
            data.updatedAt || Date.now()
        ).run();
    }

    /**
     * 批量创建文件记录 (SOTA: 使用 D1 batch)
     * @param {Array<Object>} items
     * @returns {Promise<void>}
     */
    async createBatch(items) {
        if (!items.length) return;

        const stmts = items.map((data) =>
            this.db.prepare(
                `INSERT INTO files (
                    id, folder_id, name, original_name, storage_key,
                    size, mime_type, content_hash, original_hash, created_by,
                    created_at, updated_at, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
            ).bind(
                data.id,
                data.folderId || 'root',
                data.name || 'unnamed',
                data.originalName || data.name || 'unnamed',
                data.storageKey,
                data.size || 0,
                data.mimeType || 'application/octet-stream',
                data.contentHash || null,
                data.originalHash || null,
                data.createdBy || null,
                data.createdAt || Date.now(),
                data.updatedAt || Date.now()
            )
        );

        await this.db.batch(stmts);
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
     * 根据原始哈希查询文件 (用于跨设备秒传) - 仅查询活跃文件
     */
    async findByOriginalHash(hash) {
        return await this.db.prepare(

            "SELECT id, name, storage_key, mime_type, size FROM files WHERE original_hash = ? AND (is_deleted IS NULL OR is_deleted = 0) LIMIT 1"
        ).bind(hash).first();
    }

    /**
     * 获取文件列表（含分页）
     * @param {Object} filter
     * @param {Object} pagination
     */
    async findAll(filter = {}, { page = 1, limit = 50 } = {}) {
        const { page: safePage, limit: safeLimit, offset } = parseRepoPagination(
            { page, limit },
            { defaultPage: 1, defaultLimit: 50, maxLimit: 100 }
        );
        const bindings = [];

        let sql = "SELECT * FROM files";
        const where = ["(is_deleted IS NULL OR is_deleted = 0)"]; // Default filter: non-deleted

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
        bindings.push(safeLimit, offset);

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
        await this.db.prepare(`UPDATE files SET folder_id = ?, updated_at = ? WHERE id IN ${inClause(ids)}`)
            .bind(targetFolderId, Date.now(), ...ids)
            .run();
    }

    /**
     * 根据 ID 删除文件记录 (物理删除)
     * @param {string} id
     */
    async delete(id) {
        await this.db.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
    }

    /**
     * 批量删除文件记录 (物理删除)
     * @param {Array<string>} ids
     */
    async deleteBatch(ids) {
        if (!ids.length) return;
        await this.db.prepare(`DELETE FROM files WHERE id IN ${inClause(ids)}`)
            .bind(...ids)
            .run();
    }

    // --- 回收站相关 ---

    /**
     * 软删除 (移入回收站)
     * @param {string} id 
     */
    async softDelete(id) {
        await this.db.prepare("UPDATE files SET is_deleted = 1, deleted_at = ? WHERE id = ?")
            .bind(Date.now(), id)
            .run();
    }

    /**
     * 批量软删除
     * @param {Array<string>} ids 
     */
    async softDeleteBatch(ids) {
        if (!ids.length) return;
        await this.db.prepare(`UPDATE files SET is_deleted = 1, deleted_at = ? WHERE id IN ${inClause(ids)}`)
            .bind(Date.now(), ...ids)
            .run();
    }

    /**
     * 还原文件
     * @param {Array<string>} ids 
     */
    async restoreBatch(ids) {
        if (!ids.length) return;
        await this.db.prepare(`UPDATE files SET is_deleted = 0, deleted_at = NULL WHERE id IN ${inClause(ids)}`)
            .bind(...ids)
            .run();
    }

    /**
     * 获取回收站文件
     */
    async findTrash() {
        return this.findTrashWithPaths();
    }

    /**
     * 获取回收站文件 (带路径)
     */
    async findTrashWithPaths() {
        const { results } = await this.db.prepare(`
            WITH RECURSIVE folder_paths(id, path) AS (
                SELECT id, name
                FROM folders
                WHERE parent_id IS NULL OR parent_id = 'root'
                
                UNION ALL
                
                SELECT f.id, fp.path || '/' || f.name
                FROM folders f
                JOIN folder_paths fp ON f.parent_id = fp.id
            )
            SELECT f.*, 
                CASE 
                    WHEN f.folder_id = 'root' OR f.folder_id IS NULL THEN '/'
                    ELSE COALESCE('/' || fp.path, '/')
                END as original_path
            FROM files f
            LEFT JOIN folder_paths fp ON f.folder_id = fp.id
            WHERE f.is_deleted = 1
            ORDER BY f.deleted_at DESC
        `).all();
        return results;
    }

    /**
     * 在指定文件夹中查找同名文件 (仅查找 active)
     * @param {string} folderId 
     * @param {string} name 
     * @returns {Promise<Object|null>}
     */
    async findByNameInFolder(folderId, name) {
        let sql = "SELECT * FROM files WHERE name = ? AND (is_deleted IS NULL OR is_deleted = 0)";
        const bindings = [name];

        if (folderId && folderId !== 'root') {
            sql += ' AND folder_id = ?';
            bindings.push(folderId);
        } else {
            sql += " AND (folder_id = 'root' OR folder_id IS NULL)";
        }

        return await this.db.prepare(sql).bind(...bindings).first();
    }

    /**
     * 在指定文件夹中检查同名文件（支持排除自己）
     * @param {string} folderId
     * @param {string} name
     * @param {string} [excludeId]
     * @returns {Promise<boolean>}
     */
    async checkNameConflict(folderId, name, excludeId = null) {
        let sql = "SELECT 1 as exist FROM files WHERE name = ? AND (is_deleted IS NULL OR is_deleted = 0)";
        const bindings = [name];

        if (folderId && folderId !== 'root') {
            sql += " AND folder_id = ?";
            bindings.push(folderId);
        } else {
            sql += " AND (folder_id = 'root' OR folder_id IS NULL)";
        }

        if (excludeId) {
            sql += " AND id != ?";
            bindings.push(excludeId);
        }

        sql += " LIMIT 1";
        const result = await this.db.prepare(sql).bind(...bindings).first();
        return !!result;
    }

    /**
     * 批量查询当前移动的多个文件名字，在目标文件夹中是否有重名
     * @param {string} folderId 
     * @param {Array<string>} names 
     * @returns {Promise<Array<string>>} - 返回有冲突的文件名数组
     */
    async findConflictingNames(folderId, names) {
        if (!names || names.length === 0) return [];

        const bindings = [...names];

        let sql = `SELECT name FROM files WHERE name IN ${inClause(names)} AND (is_deleted IS NULL OR is_deleted = 0)`;
        
        if (folderId && folderId !== 'root') {
            sql += " AND folder_id = ?";
            bindings.push(folderId);
        } else {
            sql += " AND (folder_id = 'root' OR folder_id IS NULL)";
        }

        const { results } = await this.db.prepare(sql).bind(...bindings).all();
        return results.map(r => r.name);
    }
    
    /**
     * 获取指定 ID 集合的文件记录
     * @param {Array<string>} ids 
     * @returns {Promise<Array<Object>>}
     */
    async findByIds(ids) {
        if (!ids || ids.length === 0) return [];
        const { results } = await this.db.prepare(`SELECT * FROM files WHERE id IN ${inClause(ids)}`).bind(...ids).all();
        return results;
    }
}
