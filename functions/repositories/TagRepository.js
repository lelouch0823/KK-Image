/**
 * 标签仓库 (Tag Repository)
 * ===================================
 */

export class TagRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 获取所有标签
     * @returns {Promise<Object[]>}
     */
    async findAll() {
        const { results } = await this.db.prepare(
            'SELECT * FROM tags ORDER BY name ASC'
        ).all();
        return results;
    }

    /**
     * 创建标签
     * @param {{ id: string, name: string, color?: string, createdAt: number }} data
     * @throws {Error} 如果标签名已存在（UNIQUE 约束）
     */
    async create(data) {
        await this.db.prepare(
            'INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)'
        ).bind(data.id, data.name, data.color || null, data.createdAt).run();
    }

    /**
     * 分配标签到文件
     * @param {{ fileId: string, tagId: string, createdAt: number }} data
     */
    async assignToFile(data) {
        await this.db.prepare(
            'INSERT INTO file_tags (file_id, tag_id, created_at) VALUES (?, ?, ?)'
        ).bind(data.fileId, data.tagId, data.createdAt).run();
    }

    /**
     * 从文件移除标签
     * @param {string} fileId
     * @param {string} tagId
     */
    async removeFromFile(fileId, tagId) {
        await this.db.prepare(
            'DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?'
        ).bind(fileId, tagId).run();
    }
}
