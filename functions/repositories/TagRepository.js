/**
 * 标签仓库 (Tag Repository)
 * ===================================
 */
export class TagRepository {
    db;
    now;
    /**
     * 构造函数
     * @param db Cloudflare D1 数据库实例
     * @param deps 依赖注入
     * @param deps.now 时间戳函数，默认 Date.now
     */
    constructor(db, deps = {}) {
        this.db = db;
        this.now = deps.now || (() => Date.now());
    }
    /**
     * 获取所有标签
     * @returns 标签列表
     */
    async findAll() {
        const { results } = await this.db.prepare('SELECT id, name, color, created_at FROM tags ORDER BY name ASC').all();
        return results;
    }
    /**
     * 创建标签
     * @param data 标签数据
     * @returns 创建结果
     * @throws 如果标签名已存在（UNIQUE 约束）
     */
    async create(data) {
        await this.db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)').bind(data.id, data.name, data.color || null, data.createdAt || this.now()).run();
        return { id: data.id };
    }
    /**
     * 分配标签到文件
     * @param data 分配数据
     */
    async assignToFile(data) {
        await this.db.prepare('INSERT INTO file_tags (file_id, tag_id, created_at) VALUES (?, ?, ?)').bind(data.fileId, data.tagId, data.createdAt).run();
    }
    /**
     * 从文件移除标签
     * @param fileId 文件 ID
     * @param tagId 标签 ID
     * @returns 是否实际删除
     */
    async removeFromFile(fileId, tagId) {
        const result = await this.db.prepare('DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?').bind(fileId, tagId).run();
        return (result?.meta?.changes || 0) > 0;
    }
    /**
     * 标签名称搜索建议（轻量级）
     * @param query 搜索关键词
     * @param limit 最大返回条数
     * @returns 标签建议列表
     */
    async suggest(query, limit = 10) {
        if (!query || !query.trim())
            return [];
        const term = `%${query.trim()}%`;
        const { results } = await this.db.prepare('SELECT id, name, color FROM tags WHERE name LIKE ? ORDER BY name ASC LIMIT ?').bind(term, limit).all();
        return results;
    }
}
