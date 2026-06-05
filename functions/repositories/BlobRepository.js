/**
 * Blob 仓库 (Blob Repository)
 * ===================================
 *
 * 负责 Content-Addressable Storage (blobs) 表的数据库操作。
 * 管理 blob 引用计数和去重逻辑。
 */

export class BlobRepository {
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
     * 根据哈希查询 blob 记录
     * @param {string} hash - SHA-256 哈希
     * @returns {Promise<Object|null>}
     */
    async findByHash(hash) {
        if (!hash) return null;
        return await this.db.prepare(
            'SELECT content_hash, size, mime_type, ref_count FROM blobs WHERE content_hash = ?'
        ).bind(hash).first();
    }

    /**
     * 创建新的 blob 记录
     * @param {string} hash - SHA-256 哈希
     * @param {number} size - 文件大小
     * @param {string} mimeType - MIME 类型
     * @returns {Promise<{ id: string }>}
     */
    async create(hash, size, mimeType) {
        const timestamp = this.now();
        await this.db.prepare(
            'INSERT INTO blobs (content_hash, size, mime_type, ref_count, created_at) VALUES (?, ?, ?, 1, ?)'
        ).bind(hash, size, mimeType, timestamp).run();

        return { id: hash };
    }

    /**
     * 增加 blob 引用计数
     * @param {string} hash - SHA-256 哈希
     * @returns {Promise<void>}
     */
    async incrementRefCount(hash) {
        await this.db.prepare(
            'UPDATE blobs SET ref_count = ref_count + 1 WHERE content_hash = ?'
        ).bind(hash).run();
    }

    /**
     * 原子减少引用计数并返回更新后的引用计数
     * 使用 D1 batch 保证原子性，避免 TOCTOU 竞态
     * @param {string} hash - SHA-256 哈希
     * @returns {Promise<Object|null>} 更新后的 blob 记录，不存在则返回 null
     */
    async decrementRefCount(hash) {
        const updateStmt = this.db.prepare(
            'UPDATE blobs SET ref_count = ref_count - 1 WHERE content_hash = ?'
        ).bind(hash);

        const selectStmt = this.db.prepare(
            'SELECT ref_count FROM blobs WHERE content_hash = ?'
        ).bind(hash);

        const [, selectResult] = await this.db.batch([updateStmt, selectStmt]);
        return selectResult.results?.[0] || null;
    }

    /**
     * 删除引用计数为 0 的 blob 记录
     * @param {string} hash - SHA-256 哈希
     * @returns {Promise<void>}
     */
    async deleteByHashIfUnreferenced(hash) {
        await this.db.prepare(
            'DELETE FROM blobs WHERE content_hash = ? AND ref_count <= 0'
        ).bind(hash).run();
    }
}
