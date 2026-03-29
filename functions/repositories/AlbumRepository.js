import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';

/**
 * 相册仓库 (Album Repository)
 * ===================================
 */

export class AlbumRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 获取相册列表
     */
    async findAll() {
        const { results } = await this.db.prepare(`
            SELECT a.*, 
                (SELECT COUNT(*) FROM album_files WHERE album_id = a.id) as file_count,
                (SELECT f.storage_key FROM files f 
                 JOIN album_files af ON f.id = af.file_id 
                 WHERE af.album_id = a.id LIMIT 1) as cover_key
            FROM albums a ORDER BY a.updated_at DESC
        `).all();
        return results;
    }

    /**
     * 根据 ID 获取相册
     */
    async findById(id) {
        return await this.db.prepare('SELECT * FROM albums WHERE id = ?').bind(id).first();
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
            data.createdAt,
            data.updatedAt
        ).run();
    }

    /**
     * 更新相册
     */
    async update(id, updates, values) {
        await this.db.prepare(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`)
            .bind(...values, id)
            .run();
        return await this.findById(id);
    }

    /**
     * 删除相册 (事务)
     */
    async delete(id) {
        await this.db.batch([
            this.db.prepare('DELETE FROM album_files WHERE album_id = ?').bind(id),
            this.db.prepare('DELETE FROM albums WHERE id = ?').bind(id),
        ]);
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
