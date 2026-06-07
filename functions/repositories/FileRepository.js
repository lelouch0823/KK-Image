/**
 * 文件仓库 (File Repository)
 * ===================================
 *
 * 负责文件记录 (Files) 的数据库基础操作。
 */
import { inClause, buildSetClause } from '../api/utils/sql.js';
import { parseRepoPagination } from '../api/utils/pagination.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { FOLDER_PATHS_CTE } from '../lib/db/trash-paths-cte.js';

/** 允许更新的列名白名单 */
const ALLOWED_UPDATE_COLUMNS = new Set([
  'name',
  'original_name',
  'folder_id',
  'storage_key',
  'size',
  'mime_type',
  'content_hash',
  'original_hash',
  'status',
  'metadata',
  'tags',
]);

export class FileRepository {
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
   * 获取文件夹下的文件列表
   * @param {string} folderId
   * @returns {Promise<Array>}
   */
  async findByFolder(folderId) {
    const { results } = await this.db
      .prepare(
        'SELECT id, folder_id, name, original_name, mime_type, size, storage_key, content_hash, status, created_at FROM files WHERE folder_id = ? AND is_deleted = 0 ORDER BY created_at DESC'
      )
      .bind(folderId)
      .all();
    return results;
  }

  /**
   * 创建文件记录
   * @param {Object} data
   * @returns {Promise<{ id: string }>}
   */
  async create(data) {
    await this.db
      .prepare(
        `INSERT INTO files (
                id, folder_id, name, original_name, storage_key,
                size, mime_type, content_hash, original_hash, created_by,
                created_at, updated_at, is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .bind(
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
        data.createdAt || this.now(),
        data.updatedAt || this.now()
      )
      .run();

    return { id: data.id };
  }

  /**
   * 批量创建文件记录 (SOTA: 使用 D1 batch)
   * @param {Array<Object>} items
   * @returns {Promise<void>}
   */
  async createBatch(items) {
    if (!items.length) return;

    const stmts = items.map((data) =>
      this.db
        .prepare(
          `INSERT INTO files (
                    id, folder_id, name, original_name, storage_key,
                    size, mime_type, content_hash, original_hash, created_by,
                    created_at, updated_at, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
        )
        .bind(
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

    await executeBatchChunks(this.db, stmts);
  }

  /**
   * 根据 ID 获取文件记录
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await this.db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
    return result || null;
  }

  /**
   * 根据原始哈希查询文件 (用于跨设备秒传) - 仅查询活跃文件
   */
  async findByOriginalHash(hash) {
    return await this.db
      .prepare(
        'SELECT id, name, storage_key, mime_type, size FROM files WHERE original_hash = ? AND (is_deleted IS NULL OR is_deleted = 0) LIMIT 1'
      )
      .bind(hash)
      .first();
  }

  /**
   * 获取文件列表（含分页）
   * @param {Object} filter
   * @param {Object} pagination
   */
  async findAll(filter = {}, { page = 1, limit = 50 } = {}) {
    const {
      page: safePage,
      limit: safeLimit,
      offset,
    } = parseRepoPagination({ page, limit }, { defaultPage: 1, defaultLimit: 50, maxLimit: 100 });
    const bindings = [];
    const where = ['(is_deleted IS NULL OR is_deleted = 0)']; // Default filter: non-deleted

    if (filter.folderId) {
      where.push('folder_id = ?');
      bindings.push(filter.folderId);
    } else if (filter.rootOnly) {
      where.push("(folder_id = 'root' OR folder_id IS NULL)");
    }

    const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';

    // 独立构建 count SQL，避免 replace 方式的脆弱性
    const countSql = `SELECT COUNT(*) as total FROM files${whereClause}`;
    const countResult = await this.db
      .prepare(countSql)
      .bind(...bindings)
      .first();
    const total = countResult?.total || 0;

    const sql = `SELECT id, folder_id, name, original_name, mime_type, size, storage_key, content_hash, status, created_at FROM files${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const listBindings = [...bindings, safeLimit, offset];
    const { results } = await this.db
      .prepare(sql)
      .bind(...listBindings)
      .all();

    return {
      items: results,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * 更新文件信息
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<boolean>} 是否实际更新
   */
  async update(id, updates) {
    // 过滤只允许更新的列名（防止 SQL 注入）
    const safeKeys = Object.keys(updates).filter((k) => ALLOWED_UPDATE_COLUMNS.has(k));
    if (safeKeys.length === 0) return false;

    const updateData = Object.fromEntries(safeKeys.map((key) => [key, updates[key]]));
    updateData.updated_at = this.now();
    const { clause, values } = buildSetClause(updateData);

    const result = await this.db
      .prepare(`UPDATE files SET ${clause} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return (result?.meta?.changes || 0) > 0;
  }

  /**
   * 批量移动文件
   * @param {Array<string>} ids
   * @param {string} targetFolderId
   */
  async moveBatch(ids, targetFolderId) {
    for (const idChunk of chunkArray(ids, 98)) {
      await this.db
        .prepare(`UPDATE files SET folder_id = ?, updated_at = ? WHERE id IN ${inClause(idChunk)}`)
        .bind(targetFolderId, Date.now(), ...idChunk)
        .run();
    }
  }

  /**
   * 根据 ID 删除文件记录 (物理删除)
   * @param {string} id
   * @returns {Promise<boolean>} 是否实际删除
   */
  async delete(id) {
    const result = await this.db.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
    return (result?.meta?.changes || 0) > 0;
  }

  /**
   * 批量删除文件记录 (物理删除)
   * @param {Array<string>} ids
   */
  async deleteBatch(ids) {
    if (!ids.length) return;
    for (const idChunk of chunkArray(ids, 98)) {
      await this.db
        .prepare(`DELETE FROM files WHERE id IN ${inClause(idChunk)}`)
        .bind(...idChunk)
        .run();
    }
  }

  // --- 回收站相关 ---

  /**
   * 软删除 (移入回收站)
   * @param {string} id
   */
  async softDelete(id) {
    await this.db
      .prepare('UPDATE files SET is_deleted = 1, deleted_at = ? WHERE id = ?')
      .bind(Date.now(), id)
      .run();
  }

  /**
   * 批量软删除
   * @param {Array<string>} ids
   */
  async softDeleteBatch(ids) {
    if (!ids.length) return;
    for (const idChunk of chunkArray(ids, 98)) {
      await this.db
        .prepare(`UPDATE files SET is_deleted = 1, deleted_at = ? WHERE id IN ${inClause(idChunk)}`)
        .bind(Date.now(), ...idChunk)
        .run();
    }
  }

  /**
   * 还原文件
   * @param {Array<string>} ids
   */
  async restoreBatch(ids) {
    if (!ids.length) return;
    for (const idChunk of chunkArray(ids, 98)) {
      await this.db
        .prepare(
          `UPDATE files SET is_deleted = 0, deleted_at = NULL WHERE id IN ${inClause(idChunk)}`
        )
        .bind(...idChunk)
        .run();
    }
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
    const { results } = await this.db
      .prepare(
        `
            ${FOLDER_PATHS_CTE}
            SELECT f.*,
                CASE
                    WHEN f.folder_id = 'root' OR f.folder_id IS NULL THEN '/'
                    ELSE COALESCE('/' || fp.path, '/')
                END as original_path
            FROM files f
            LEFT JOIN folder_paths fp ON f.folder_id = fp.id
            WHERE f.is_deleted = 1
            ORDER BY f.deleted_at DESC
        `
      )
      .all();
    return results;
  }

  /**
   * 在指定文件夹中查找同名文件 (仅查找 active)
   * @param {string} folderId
   * @param {string} name
   * @returns {Promise<Object|null>}
   */
  async findByNameInFolder(folderId, name) {
    let sql =
      'SELECT id, folder_id, name, storage_key, mime_type, size, content_hash, original_hash, status, created_at FROM files WHERE name = ? AND (is_deleted IS NULL OR is_deleted = 0)';
    const bindings = [name];

    if (folderId && folderId !== 'root') {
      sql += ' AND folder_id = ?';
      bindings.push(folderId);
    } else {
      sql += " AND (folder_id = 'root' OR folder_id IS NULL)";
    }

    return await this.db
      .prepare(sql)
      .bind(...bindings)
      .first();
  }

  /**
   * 在指定文件夹中检查同名文件（支持排除自己）
   * @param {string} folderId
   * @param {string} name
   * @param {string} [excludeId]
   * @returns {Promise<boolean>}
   */
  async checkNameConflict(folderId, name, excludeId = null) {
    let sql =
      'SELECT 1 as exist FROM files WHERE name = ? AND (is_deleted IS NULL OR is_deleted = 0)';
    const bindings = [name];

    if (folderId && folderId !== 'root') {
      sql += ' AND folder_id = ?';
      bindings.push(folderId);
    } else {
      sql += " AND (folder_id = 'root' OR folder_id IS NULL)";
    }

    if (excludeId) {
      sql += ' AND id != ?';
      bindings.push(excludeId);
    }

    sql += ' LIMIT 1';
    const result = await this.db
      .prepare(sql)
      .bind(...bindings)
      .first();
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

    const matches = [];
    for (const nameChunk of chunkArray(names, 98)) {
      const chunkBindings = [...nameChunk];
      let chunkSql = `SELECT name FROM files WHERE name IN ${inClause(nameChunk)} AND (is_deleted IS NULL OR is_deleted = 0)`;

      if (folderId && folderId !== 'root') {
        chunkSql += ' AND folder_id = ?';
        chunkBindings.push(folderId);
      } else {
        chunkSql += " AND (folder_id = 'root' OR folder_id IS NULL)";
      }

      const { results } = await this.db
        .prepare(chunkSql)
        .bind(...chunkBindings)
        .all();
      matches.push(...(results || []).map((r) => r.name));
    }
    return matches;
  }

  /**
   * 获取指定 ID 集合的文件记录
   * @param {Array<string>} ids
   * @returns {Promise<Array<Object>>}
   */
  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const rows = [];
    for (const idChunk of chunkArray(ids, 98)) {
      const { results } = await this.db
        .prepare(`SELECT * FROM files WHERE id IN ${inClause(idChunk)}`)
        .bind(...idChunk)
        .all();
      rows.push(...(results || []));
    }
    return rows;
  }
}
