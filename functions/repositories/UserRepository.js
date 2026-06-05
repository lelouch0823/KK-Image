/**
 * 用户仓库 (User Repository)
 * ===================================
 *
 * 负责用户记录 (Users) 的数据库基础操作。
 */
import { buildSetClause } from '../api/utils/sql.js';

/** 允许更新的列名白名单 */
const ALLOWED_UPDATE_COLUMNS = new Set([
    'username', 'password_hash', 'name', 'email', 'role', 'permissions'
]);

/** 查询字段列表（排除敏感信息） */
const SELECT_FIELDS = 'id, username, name, email, role, permissions, created_at, updated_at';

export class UserRepository {
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
     * 根据 ID 获取用户
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const result = await this.db.prepare(`SELECT ${SELECT_FIELDS} FROM users WHERE id = ?`)
            .bind(id)
            .first();
        return result || null;
    }

    /**
     * 根据用户名获取用户（含密码哈希，用于认证）
     * @param {string} username
     * @returns {Promise<Object|null>}
     */
    async findByUsername(username) {
        return await this.db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
            .bind(username)
            .first();
    }

    /**
     * 根据用户名获取用户（含角色和权限，用于管理端认证）
     * @param {string} username
     * @returns {Promise<Object|null>}
     */
    async findByUsernameForAuth(username) {
        return await this.db.prepare('SELECT id, password_hash, name, role, permissions FROM users WHERE username = ?')
            .bind(username)
            .first();
    }

    /**
     * 更新用户密码哈希
     * @param {string} id
     * @param {string} passwordHash
     */
    async updatePasswordHash(id, passwordHash) {
        await this.db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
            .bind(passwordHash, Date.now(), id)
            .run();
    }

    /**
     * 数据库连通性检查（用于健康检查）
     * @returns {Promise<boolean>}
     */
    static async ping(db) {
        try {
            await db.prepare('SELECT 1').first();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 检查用户名是否已存在
     * @param {string} username
     * @returns {Promise<boolean>}
     */
    async existsByUsername(username) {
        const row = await this.db.prepare('SELECT 1 FROM users WHERE username = ?')
            .bind(username)
            .first();
        return !!row;
    }

    /**
     * 获取全部用户列表
     * @returns {Promise<Array>}
     */
    async findAll() {
        const { results } = await this.db.prepare(`SELECT ${SELECT_FIELDS} FROM users`).all();
        return results;
    }

    /**
     * 创建用户
     * @param {Object} data
     * @param {string} data.id
     * @param {string} data.username
     * @param {string} data.passwordHash
     * @param {string} [data.name]
     * @param {string} [data.email]
     * @param {string} [data.role]
     * @param {string} [data.permissions]
     * @param {number} [data.createdAt]
     * @returns {Promise<{ id: string }>}
     */
    async create(data) {
        await this.db.prepare(
            `INSERT INTO users (id, username, password_hash, name, email, role, permissions, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.id,
            data.username,
            data.passwordHash,
            data.name || null,
            data.email || null,
            data.role || 'user',
            data.permissions || '[]',
            data.createdAt || this.now()
        ).run();

        return { id: data.id };
    }

    /**
     * 更新用户信息
     * @param {string} id
     * @param {Object} updates - 列名 -> 值的映射（列名必须在白名单内）
     * @returns {Promise<boolean>} 是否实际更新
     */
    async update(id, updates) {
        const safeKeys = Object.keys(updates).filter(k => ALLOWED_UPDATE_COLUMNS.has(k));
        if (safeKeys.length === 0) return false;

        const updateData = Object.fromEntries(safeKeys.map((key) => [key, updates[key]]));
        updateData.updated_at = this.now();
        const { clause, values } = buildSetClause(updateData);

        const result = await this.db.prepare(`UPDATE users SET ${clause} WHERE id = ?`)
            .bind(...values, id)
            .run();

        return (result?.meta?.changes || 0) > 0;
    }

    /**
     * 删除用户
     * @param {string} id
     * @returns {Promise<boolean>} 是否实际删除
     */
    async delete(id) {
        const result = await this.db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
        return (result?.meta?.changes || 0) > 0;
    }
}
