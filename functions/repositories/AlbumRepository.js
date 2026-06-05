import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';

/**
 * 相册仓库 (Album Repository)
 * ===================================
 */
import { buildSetClause } from '../api/utils/sql.js';

export class AlbumRepository {
    /**
     * 构造函数
     * @param {D1Database} db - Cloudflare D1 数据库实例
     * @param {Object} [deps] - 依赖注入
     * @param {Function} [deps.now] - 时间戳函数，默认 Date.now
     */
    constructor(db, deps = {}) {
        this.db = db;
        this.now = deps.now || Date.now;
    }

    /**
     * 获取相册列表
     */
    async findAll() {
        const { results } = await this.db.prepare(`
            SELECT a.*,
                COALESCE(af_agg.file_count, 0) as file_count,
                af_agg.cover_key
            FROM albums a
            LEFT JOIN (
                SELECT af.album_id,
                    COUNT(*) as file_count,
                    MIN(f.storage_key) as cover_key
                FROM album_files af
                JOIN files f ON f.id = af.file_id
                GROUP BY af.album_id
            ) af_agg ON af_agg.album_id = a.id
            ORDER BY a.updated_at DESC
        `).all();
        return results;
    }

    /**
     * 根据 ID 获取相册
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const result = await this.db.prepare('SELECT * FROM albums WHERE id = ?').bind(id).first();
        return result || null;
    }

    /**
     * 获取相册文件列表
     */
    async getFiles(id) {
        const { results } = await this.db.prepare(`
            SELECT f.* FROM files f
            JOIN album_files af ON f.id = af.file_id
            WHERE af.album_id = ?
            ORDER BY af.sort_order ASC, f.created_at DESC
        `).bind(id).all();
        return results;
    }

    /**
     * 创建相册
     * @param {Object} data
     * @returns {Promise<{ id: string }>}
     */
    async create(data) {
        await this.db.prepare(`
            INSERT INTO albums (id, name, description, is_public, share_token, cover_file_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.id,
            data.name,
            data.description,
            data.isPublic ? 1 : 0,
            data.shareToken,
            data.coverFileId || null,
            data.createdAt || this.now(),
            data.updatedAt || this.now()
        ).run();

        return { id: data.id };
    }

    /**
     * 更新相册
     * @param {string} id
     * @param {Object} updates - 列名 -> 值的映射
     * @returns {Promise<boolean>} 是否实际更新
     */
    async update(id, updates) {
        if (!updates || Object.keys(updates).length === 0) return false;

        const updateData = { ...updates };
        updateData.updated_at = this.now();
        const { clause, values } = buildSetClause(updateData);

        const result = await this.db.prepare(`UPDATE albums SET ${clause} WHERE id = ?`)
            .bind(...values, id)
            .run();

        return (result?.meta?.changes || 0) > 0;
    }

    /**
     * 删除相册 (事务)
     * @param {string} id
     * @returns {Promise<boolean>} 是否实际删除
     */
    async delete(id) {
        await this.db.batch([
            this.db.prepare('DELETE FROM album_files WHERE album_id = ?').bind(id),
            this.db.prepare('DELETE FROM albums WHERE id = ?').bind(id),
        ]);
        return true;
    }

    /**
     * 添加文件到相册
     */
    async addFiles(albumId, fileIds) {
        const statements = fileIds.map((fileId, index) =>
            this.db.prepare(
                'INSERT OR IGNORE INTO album_files (album_id, file_id, sort_order) VALUES (?, ?, ?)'
            ).bind(albumId, fileId, index)
        );
        await executeBatchChunks(this.db, statements);
        await this.db.prepare('UPDATE albums SET updated_at = ? WHERE id = ?')
            .bind(Date.now(), albumId).run();
    }

    /**
     * 从相册移除文件
     */
    async removeFiles(albumId, fileIds) {
        for (const fileIdChunk of chunkArray(fileIds, 98)) {
            const placeholders = fileIdChunk.map(() => '?').join(',');
            await this.db.prepare(`DELETE FROM album_files WHERE album_id = ? AND file_id IN (${placeholders})`)
                .bind(albumId, ...fileIdChunk).run();
        }
    }
}
