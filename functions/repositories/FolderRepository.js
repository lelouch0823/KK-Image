/**
 * 文件夹仓库 (Folder Repository)
 * ===================================
 *
 * 涉及文件夹的 CRUD、层级统计及物理存储清理关联逻辑。
 */
import { inClause, buildSetClause } from '../api/utils/sql.js';
import { parseRepoPagination } from '../api/utils/pagination.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { FOLDER_PATHS_CTE } from '../lib/db/trash-paths-cte.js';
import { encodeSharePasswordForStorage } from '../api/utils/id.js';

/** 允许通过 update() 方法更新的列名白名单 (H04) */
const ALLOWED_UPDATE_COLUMNS = new Set([
  'name',
  'description',
  'sort_order',
  'color',
  'icon',
  'parent_id',
  'share_token',
  'is_public',
  'password',
  'share_expires_at',
]);

/** 子文件夹计数 JOIN 子查询 */
const SUBFOLDER_COUNT_JOIN = `LEFT JOIN (
    SELECT parent_id, COUNT(*) as subfolder_count
    FROM folders
    WHERE is_deleted = 0
    GROUP BY parent_id
) sub ON sub.parent_id = f.id`;

/** 文件计数 JOIN 子查询 */
const FILE_COUNT_JOIN = `LEFT JOIN (
    SELECT folder_id, COUNT(*) as file_count
    FROM files
    WHERE is_deleted = 0
    GROUP BY folder_id
) fc ON fc.folder_id = f.id`;

export class FolderRepository {
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
   * 获取所有文件夹（极简列表，用于选择器）- 仅 active
   */
  async findAllMinimal() {
    const { results } = await this.db
      .prepare('SELECT id, parent_id, name FROM folders WHERE is_deleted = 0 ORDER BY name ASC')
      .all();
    return results;
  }

  /**
   * 获取顶层文件夹列表（含子文件夹和文件计数）- 仅 active
   */
  async findTopLevel() {
    const { results } = await this.db
      .prepare(
        `
            SELECT f.*,
                COALESCE(sub.subfolder_count, 0) as subfolder_count,
                COALESCE(fc.file_count, 0) as file_count
            FROM folders f
            ${SUBFOLDER_COUNT_JOIN}
            ${FILE_COUNT_JOIN}
            WHERE (f.parent_id IS NULL OR f.parent_id = 'root')
              AND f.is_deleted = 0
            ORDER BY f.created_at DESC
        `
      )
      .all();
    return results;
  }

  /**
   * 获取子文件夹列表 - 仅 active
   */
  async findByParent(parentId) {
    const { results } = await this.db
      .prepare(
        `
            SELECT f.*,
                COALESCE(sub.subfolder_count, 0) as subfolder_count,
                COALESCE(fc.file_count, 0) as file_count
            FROM folders f
            ${SUBFOLDER_COUNT_JOIN}
            ${FILE_COUNT_JOIN}
            WHERE f.parent_id = ?
              AND f.is_deleted = 0
            ORDER BY f.created_at DESC
        `
      )
      .bind(parentId)
      .all();
    return results;
  }

  /**
   * 根据 ID 获取文件夹
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await this.db.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first();
    return result || null;
  }

  /**
   * 递归获取面包屑导航 (SOTA: 使用 WITH RECURSIVE 一次查询)
   * 此处应仅包含 active 的祖先？如果父文件夹 deleted，子文件夹不应该显示？
   */
  async getBreadcrumbs(folderId) {
    if (!folderId || folderId === 'root') return [];

    const { results } = await this.db
      .prepare(
        `
            WITH RECURSIVE ancestors AS (
                SELECT id, name, parent_id, 1 as depth, is_deleted
                FROM folders
                WHERE id = ?
                
                UNION ALL
                
                SELECT f.id, f.name, f.parent_id, a.depth + 1, f.is_deleted
                FROM folders f
                JOIN ancestors a ON f.id = a.parent_id
                WHERE a.parent_id IS NOT NULL AND a.parent_id != 'root'
            )
            SELECT id, name FROM ancestors WHERE is_deleted = 0 ORDER BY depth DESC
        `
      )
      .bind(folderId)
      .all();

    return results.map((f) => ({ id: f.id, name: f.name }));
  }

  /**
   * 创建文件夹
   * @param {Object} data
   * @returns {Promise<{ id: string }>}
   */
  async create(data) {
    await this.db
      .prepare(
        `INSERT INTO folders (id, parent_id, name, description, share_token, is_public, password, created_at, updated_at, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .bind(
        data.id,
        data.parentId || null,
        data.name,
        data.description || '',
        data.shareToken || null,
        data.isPublic ? 1 : 0,
        data.password || null,
        data.createdAt || this.now(),
        data.updatedAt || this.now()
      )
      .run();

    return { id: data.id };
  }

  /**
   * 更新文件夹
   * @param {string} id
   * @param {Object} updates - 列名 -> 值的映射
   * @returns {Promise<boolean>} 是否实际更新
   */
  async update(id, updates) {
    if (!updates || Object.keys(updates).length === 0) return false;

    // H04: 过滤只允许更新的列名（防止恶意列名注入）
    const safeKeys = Object.keys(updates).filter((k) => ALLOWED_UPDATE_COLUMNS.has(k));
    if (safeKeys.length === 0) return false;

    const updateData = Object.fromEntries(safeKeys.map((key) => [key, updates[key]]));
    updateData.updated_at = this.now();
    const { clause, values } = buildSetClause(updateData);

    const result = await this.db
      .prepare(`UPDATE folders SET ${clause} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return (result?.meta?.changes || 0) > 0;
  }

  // --- 回收站相关 ---

  /**
   * 软删除
   */
  async softDelete(id) {
    await this.db
      .prepare('UPDATE folders SET is_deleted = 1, deleted_at = ? WHERE id = ?')
      .bind(Date.now(), id)
      .run();
  }

  /**
   * 还原
   */
  async restore(id) {
    await this.db
      .prepare('UPDATE folders SET is_deleted = 0, deleted_at = NULL WHERE id = ?')
      .bind(id)
      .run();
  }

  /**
   * 获取回收站文件夹
   */
  async findTrash() {
    return this.findTrashWithPaths();
  }

  /**
   * 获取回收站文件夹 (带路径)
   */
  async findTrashWithPaths() {
    const { results } = await this.db
      .prepare(
        `
            ${FOLDER_PATHS_CTE}
            SELECT f.*,
                CASE
                    WHEN f.parent_id = 'root' OR f.parent_id IS NULL THEN '/'
                    ELSE COALESCE('/' || fp.path, '/')
                END as original_path
            FROM folders f
            LEFT JOIN folder_paths fp ON f.parent_id = fp.id
            WHERE f.is_deleted = 1
            ORDER BY f.deleted_at DESC
        `
      )
      .all();
    return results;
  }

  /**
   * 递归获取目录下所有文件的存储 Key (SOTA: 使用 WITH RECURSIVE 一次查询)
   */
  async getAllStorageKeysRecursive(folderId) {
    const { results } = await this.db
      .prepare(
        `
            WITH RECURSIVE descendant_folders AS (
                SELECT id FROM folders WHERE id = ?
                
                UNION ALL
                
                SELECT f.id
                FROM folders f
                JOIN descendant_folders df ON f.parent_id = df.id
            )
            SELECT storage_key FROM files WHERE folder_id IN (SELECT id FROM descendant_folders)
        `
      )
      .bind(folderId)
      .all();

    return results.map((f) => f.storage_key);
  }

  /**
   * 递归删除文件夹及其内容 (SOTA: 使用 WITH RECURSIVE + batch 一次删除)
   * 注意：此方法仅处理数据库，R2 清理需另行处理
   */
  async deleteRecursive(folderId) {
    // 获取所有后代文件夹 ID
    const { results: descendantIds } = await this.db
      .prepare(
        `
            WITH RECURSIVE descendant_folders AS (
                SELECT id FROM folders WHERE id = ?
                UNION ALL
                SELECT f.id FROM folders f JOIN descendant_folders df ON f.parent_id = df.id
            )
            SELECT id FROM descendant_folders
        `
      )
      .bind(folderId)
      .all();

    const ids = descendantIds.map((r) => r.id);
    if (ids.length === 0) return;

    // 构建批量删除语句
    const statements = [];
    for (const idChunk of chunkArray(ids, 98)) {
      statements.push(
        this.db
          .prepare(`DELETE FROM files WHERE folder_id IN ${inClause(idChunk)}`)
          .bind(...idChunk),
        this.db.prepare(`DELETE FROM folders WHERE id IN ${inClause(idChunk)}`).bind(...idChunk)
      );
    }

    await executeBatchChunks(this.db, statements, 2);
  }

  /**
   * 获取所有已分享的文件夹 (含分页)
   */
  async findShared({ page = 1, limit = 20 } = {}) {
    const {
      page: safePage,
      limit: safeLimit,
      offset,
    } = parseRepoPagination({ page, limit }, { defaultPage: 1, defaultLimit: 20, maxLimit: 100 });

    const totalResult = await this.db
      .prepare('SELECT COUNT(*) as total FROM folders WHERE share_token IS NOT NULL')
      .first();
    const total = totalResult?.total || 0;

    const { results } = await this.db
      .prepare(
        'SELECT * FROM folders WHERE share_token IS NOT NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?'
      )
      .bind(safeLimit, offset)
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
   * 分页查询文件夹列表（含统计，使用 JOIN 消除 N+1 问题）
   * @param {{ parentId?: string|null, search?: string, page?: number, limit?: number }} options
   * @returns {Promise<{ items: Object[], total: number, page: number, limit: number, totalPages: number }>}
   */
  async list({ parentId, search, page = 1, limit = 20 } = {}) {
    const {
      page: safePage,
      limit: safeLimit,
      offset,
    } = parseRepoPagination({ page, limit }, { defaultPage: 1, defaultLimit: 20, maxLimit: 100 });
    const conditions = ['f.is_deleted = 0'];
    const bindings = [];

    if (parentId === null || parentId === 'null') {
      conditions.push('f.parent_id IS NULL');
    } else if (parentId) {
      conditions.push('f.parent_id = ?');
      bindings.push(parentId);
    }

    if (search) {
      conditions.push('f.name LIKE ?');
      bindings.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    // 总数查询
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as total FROM folders f WHERE ${where}`)
      .bind(...bindings)
      .first();
    const total = countResult?.total || 0;

    // 分页 + 统计查询（使用 LEFT JOIN 一次性获取 fileCount/subfolderCount）
    const { results } = await this.db
      .prepare(
        `
            SELECT f.*,
                COALESCE(sub.subfolder_count, 0) as subfolderCount,
                COALESCE(fc.file_count, 0) as fileCount
            FROM folders f
            ${SUBFOLDER_COUNT_JOIN}
            ${FILE_COUNT_JOIN}
            WHERE ${where}
            ORDER BY f.name ASC
            LIMIT ? OFFSET ?
        `
      )
      .bind(...bindings, safeLimit, offset)
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
   * 获取文件夹详情（含子文件夹和文件列表）
   * @param {string} id
   * @returns {Promise<{ folder: Object, files: Object[], subfolders: Object[] } | null>}
   */
  async findDetail(id) {
    const folder = await this.findById(id);
    if (!folder) return null;

    const [filesResult, subfoldersResult] = await Promise.all([
      this.db
        .prepare(
          'SELECT * FROM files WHERE folder_id = ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at DESC'
        )
        .bind(id)
        .all(),
      this.db
        .prepare('SELECT * FROM folders WHERE parent_id = ? AND is_deleted = 0 ORDER BY name ASC')
        .bind(id)
        .all(),
    ]);

    return {
      folder,
      files: filesResult.results,
      subfolders: subfoldersResult.results,
    };
  }

  /**
   * 更新文件夹分享设置
   * @param {string} id
   * @param {{ isPublic: boolean, password?: string, expiresAt?: string|null }} settings
   * @returns {Promise<Object>} 更新后的分享信息
   */
  async updateShareSettings(id, { isPublic, password, expiresAt }, pepper) {
    const expiresAtTs = expiresAt ? new Date(expiresAt).getTime() : null;
    const timestamp = Date.now();

    const hashedPassword = await encodeSharePasswordForStorage(password, pepper);

    await this.db
      .prepare(
        'UPDATE folders SET is_public = ?, password = ?, share_expires_at = ?, updated_at = ? WHERE id = ?'
      )
      .bind(isPublic ? 1 : 0, hashedPassword, expiresAtTs, timestamp, id)
      .run();

    return this.db
      .prepare(
        'SELECT share_token, is_public, password, share_expires_at FROM folders WHERE id = ?'
      )
      .bind(id)
      .first();
  }

  /**
   * 检查 targetId 是否为 folderId 的后代（或者就是 folderId 本身）
   * 用于防止将文件夹移动到自身或其子文件夹中造成死循环
   * @param {string} folderId 当前移动的文件夹ID
   * @param {string|null} targetId 目标父文件夹ID
   * @returns {Promise<boolean>}
   */
  async isDescendantOrSelf(folderId, targetId) {
    if (!targetId) return false; // 移动到根目录总是允许的
    if (folderId === targetId) return true;

    const { results } = await this.db
      .prepare(
        `
            WITH RECURSIVE descendant_folders AS (
                SELECT id FROM folders WHERE id = ?
                UNION ALL
                SELECT f.id FROM folders f JOIN descendant_folders df ON f.parent_id = df.id
            )
            SELECT 1 as found FROM descendant_folders WHERE id = ? LIMIT 1
        `
      )
      .bind(folderId, targetId)
      .all();

    return results.length > 0;
  }

  /**
   * 检查文件夹是否可删除（无子文件夹且无文件）
   * @param {string} id
   * @returns {Promise<{ canDelete: boolean, subfolderCount: number, fileCount: number }>}
   */
  async canDelete(id) {
    const [subfoldersResult, filesResult] = await Promise.all([
      this.db
        .prepare('SELECT COUNT(*) as count FROM folders WHERE parent_id = ? AND is_deleted = 0')
        .bind(id)
        .first(),
      this.db
        .prepare(
          'SELECT COUNT(*) as count FROM files WHERE folder_id = ? AND (is_deleted IS NULL OR is_deleted = 0)'
        )
        .bind(id)
        .first(),
    ]);
    const subfolderCount = subfoldersResult?.count || 0;
    const fileCount = filesResult?.count || 0;
    return { canDelete: subfolderCount === 0 && fileCount === 0, subfolderCount, fileCount };
  }

  /**
   * 在父目录下检查是否存在同名文件夹
   * @param {string} parentId
   * @param {string} name
   * @param {string} [excludeId] - 排除自身（用于重命名检查）
   * @returns {Promise<boolean>}
   */
  async checkNameConflict(parentId, name, excludeId = null) {
    let sql = 'SELECT 1 as exist FROM folders WHERE name = ? AND is_deleted = 0';
    const bindings = [name];

    if (parentId && parentId !== 'root') {
      sql += ' AND parent_id = ?';
      bindings.push(parentId);
    } else {
      sql += " AND (parent_id IS NULL OR parent_id = 'root')";
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
}
