import { buildSetClause } from '../api/utils/sql.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import type { D1Database } from '../types/database.js';
import type {
  SpaceRow,
  CreateSpaceData,
  CreateSubspaceData,
  SpaceStats,
  SpaceWithFiles,
} from '../types/entities.js';

/**
 * 共享空间仓库 (Space Repository)
 * ===================================
 *
 * 负责共享空间 (Spaces) 及其关联文件 (Space Files) 的数据库操作。
 * 遵循 SOTA 模式，集成真实的统计查询逻辑。
 */

export class SpaceRepository {
  protected db: D1Database;
  protected now: () => number;

  /** 允许通过 update() 修改的列名白名单 */
  private static readonly ALLOWED_UPDATE_COLUMNS = new Set([
    'name', 'description', 'is_public', 'password', 'share_token',
    'expires_at', 'template', 'template_data', 'share_mode',
    'product_id', 'variant_id', 'cover_file_id', 'sort_order',
    'parent_id', 'updated_at',
  ]);

  /**
   * 构造函数
   * @param db Cloudflare D1 数据库实例
   * @param deps 依赖注入
   * @param deps.now 时间戳函数，默认 Date.now
   */
  constructor(db: D1Database, deps: { now?: () => number } = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
  }

  _nonExpiredSpaceWhereClause(alias: string = 's'): string {
    return `(${alias}.expires_at IS NULL OR ${alias}.expires_at >= ?)`;
  }

  _productProjectionSQL(): string {
    return `
          p.id as p_bound_id,
          p.spu as p_sku,
          NULL as p_status,
          p.brand as p_brand,
          p.series as p_series,
          (
            SELECT json_group_object(pd.id, pd.name)
            FROM product_dimensions pd
            WHERE pd.product_id = p.id
          ) as p_dimension_map,
          COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price,
          p.specifications as p_specs,
          p.images as p_images,
          pv.id as pv_bound_id,
          pv.sku as pv_sku,
          pv.status as pv_status,
          pv.price as pv_price,
          pv.options_values as pv_options_values
        `;
  }

  _variantImageProjectionSQL(): string {
    return `
          (
            SELECT vi.image_id
            FROM variant_images vi
            WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
            ORDER BY vi.sort_order ASC, vi.created_at ASC
            LIMIT 1
          ) as variant_primary_image_id,
          COALESCE(
            (
              SELECT vi.image_id
              FROM variant_images vi
              WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
              ORDER BY vi.sort_order ASC, vi.created_at ASC
              LIMIT 1
            ),
            pv.image_id,
            json_extract(p.images, '$[0]')
          ) as display_image_id
        `;
  }

  _spaceFileCountJoinSQL(): string {
    return `
        LEFT JOIN (
            SELECT space_id, COUNT(*) as file_count
            FROM space_files
            GROUP BY space_id
        ) sf_count ON sf_count.space_id = s.id
      `;
  }

  _spaceProductJoinsSQL(): string {
    return `
        LEFT JOIN files f ON s.cover_file_id = f.id
        LEFT JOIN products p ON s.product_id = p.id
        LEFT JOIN product_variants pv ON s.variant_id = pv.id AND pv.product_id = s.product_id
      `;
  }

  /**
   * 获取空间列表 (含封面和文件数)
   * @returns 空间列表
   */
  async findAll(): Promise<Record<string, unknown>[]> {
    const { results } = await this.db
      .prepare(
        `
        SELECT s.*,
          COALESCE(sf_count.file_count, 0) as file_count,
          f.storage_key as cover_storage_key,
          ${this._productProjectionSQL()},
          ${this._variantImageProjectionSQL()}
        FROM spaces s
        ${this._spaceFileCountJoinSQL()}
        ${this._spaceProductJoinsSQL()}
        WHERE s.parent_id IS NULL
        ORDER BY s.updated_at DESC
      `
      )
      .all();
    return results;
  }

  /**
   * 根据 Product ID 获取相关空间列表
   * @param productId 商品 ID
   * @returns 空间列表
   */
  async findByProductId(productId: string): Promise<Record<string, unknown>[]> {
    const now = Date.now();
    const { results } = await this.db
      .prepare(
        `
        SELECT s.*,
          COALESCE(sf_count.file_count, 0) as file_count,
          f.storage_key as cover_storage_key,
          ${this._productProjectionSQL()},
          ${this._variantImageProjectionSQL()}
        FROM spaces s
        ${this._spaceFileCountJoinSQL()}
        ${this._spaceProductJoinsSQL()}
        WHERE s.product_id = ?
          AND s.parent_id IS NULL
          AND ${this._nonExpiredSpaceWhereClause('s')}
        ORDER BY s.updated_at DESC
      `
      )
      .bind(productId, now)
      .all();
    return results;
  }

  /**
   * 根据 ID 获取空间详情
   * @param id 空间 ID
   * @returns 空间详情，不存在时返回 null
   */
  async findById(id: string): Promise<Record<string, unknown> | null> {
    return await this.db.prepare(`
            SELECT s.*,
              ${this._variantImageProjectionSQL()},
              ${this._productProjectionSQL()}
            FROM spaces s
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN product_variants pv ON s.variant_id = pv.id AND pv.product_id = s.product_id
            WHERE s.id = ?
        `).bind(id).first();
  }

  /**
   * 获取空间及其文件列表
   * @param id 空间 ID
   * @returns 空间及其文件，不存在时返回 null
   */
  async getWithFiles(id: string): Promise<SpaceWithFiles | null> {
    const space = await this.findById(id);
    if (!space) return null;

    const { results: files } = await this.db
      .prepare(
        `
        SELECT f.* FROM files f
        JOIN space_files sf ON f.id = sf.file_id
        WHERE sf.space_id = ?
        ORDER BY sf.sort_order ASC, f.created_at DESC
      `
      )
      .bind(id)
      .all();

    return { space, files };
  }

  /**
   * 获取空间统计信息 (View count, stats, and trend)
   * @param id 空间 ID
   * @param days 趋势天数
   * @param startTimestamp 统计起始时间戳 (UTC)
   * @returns 统计信息
   */
  async getStats(id: string, days: number, startTimestamp: number): Promise<SpaceStats | null> {
    const space = await this.db
      .prepare('SELECT view_count, download_count FROM spaces WHERE id = ?')
      .bind(id)
      .first<{ view_count: number; download_count: number }>();

    if (!space) return null;

    const fileStats = await this.db
      .prepare(
        `SELECT
        COUNT(*) as file_count,
        COALESCE(SUM(f.size), 0) as total_size
      FROM files f
      JOIN space_files sf ON f.id = sf.file_id
      WHERE sf.space_id = ?`
      )
      .bind(id)
      .first<{ file_count: number; total_size: number }>();

    // 从 space_access_logs 表聚合真实访问数据 (使用 SOTA +8 hours 修正)
    const { results: trendData } = await this.db
      .prepare(
        `SELECT DATE(accessed_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count
       FROM space_access_logs
       WHERE space_id = ? AND accessed_at >= ?
       GROUP BY date
       ORDER BY date ASC`
      )
      .bind(id, startTimestamp)
      .all<{ date: string; count: number }>();

    return {
      viewCount: space.view_count || 0,
      downloadCount: space.download_count || 0,
      fileCount: fileStats?.file_count || 0,
      totalSize: fileStats?.total_size || 0,
      trendData,
    };
  }

  /**
   * 创建空间
   * @param data 空间数据
   * @returns 创建结果
   */
  async create(data: CreateSpaceData): Promise<{ id: string }> {
    await this.db
      .prepare(
        `
        INSERT INTO spaces (id, name, description, is_public, password, share_token, expires_at, template, template_data, share_mode, product_id, variant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        data.id,
        data.name,
        data.description,
        data.isPublic ? 1 : 0,
        data.password,
        data.shareToken,
        data.expiresAt,
        data.template,
        data.templateData,
        data.shareMode || 'none',
        data.productId || null,
        data.variantId || null,
        data.createdAt,
        data.updatedAt
      )
      .run();

    return { id: data.id };
  }

  /**
   * 更新空间
   * @param id 空间 ID
   * @param updates 列名 -> 值的映射
   * @returns 是否实际更新
   */
  async update(id: string, updates: Record<string, unknown>): Promise<boolean> {
    if (!updates || Object.keys(updates).length === 0) return false;

    // H05: 过滤非法列名，仅允许白名单中的列
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (SpaceRepository.ALLOWED_UPDATE_COLUMNS.has(key)) {
        filtered[key] = value;
      }
    }
    if (Object.keys(filtered).length === 0) return false;

    const updateData = { ...filtered };
    updateData.updated_at = this.now();
    const { clause, values } = buildSetClause(updateData);

    const result = await this.db
      .prepare(`UPDATE spaces SET ${clause} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return (result?.meta?.changes || 0) > 0;
  }

  /**
   * 删除空间 (Transaction)
   * @param id 空间 ID
   * @returns 是否实际删除
   */
  async delete(id: string): Promise<boolean> {
    await this.db.batch([
      this.db.prepare('DELETE FROM space_files WHERE space_id = ?').bind(id),
      this.db.prepare('DELETE FROM spaces WHERE id = ?').bind(id),
    ]);
    return true;
  }

  /**
   * 添加文件到空间
   * @param spaceId 空间 ID
   * @param fileIds 文件 ID 列表
   */
  async addFiles(spaceId: string, fileIds: string[]): Promise<void> {
    const statements = fileIds.map((fileId, index) =>
      this.db
        .prepare(
          'INSERT INTO space_files (space_id, file_id, sort_order, added_at) VALUES (?, ?, ?, ?)'
        )
        .bind(spaceId, fileId, index, Date.now())
    );

    await executeBatchChunks(this.db, statements);

    // Update space updated_at
    await this.db
      .prepare('UPDATE spaces SET updated_at = ? WHERE id = ?')
      .bind(Date.now(), spaceId)
      .run();
  }

  /**
   * 从空间移除文件
   * @param spaceId 空间 ID
   * @param fileIds 文件 ID 列表
   */
  async removeFiles(spaceId: string, fileIds: string[]): Promise<void> {
    for (const fileIdChunk of chunkArray(fileIds, 98)) {
      const placeholders = fileIdChunk.map(() => '?').join(',');
      await this.db
        .prepare(`DELETE FROM space_files WHERE space_id = ? AND file_id IN (${placeholders})`)
        .bind(spaceId, ...fileIdChunk)
        .run();
    }
  }

  /**
   * 更新文件排序
   * @param spaceId 空间 ID
   * @param fileIds 排序后的文件 ID 列表
   */
  async reorderFiles(spaceId: string, fileIds: string[]): Promise<void> {
    // Use a transaction batch for performance
    const statements = fileIds.map((fileId, index) =>
      this.db
        .prepare('UPDATE space_files SET sort_order = ? WHERE space_id = ? AND file_id = ?')
        .bind(index, spaceId, fileId)
    );

    // Update space updated_at
    statements.push(
      this.db
        .prepare('UPDATE spaces SET updated_at = ? WHERE id = ?')
        .bind(Date.now(), spaceId)
    );

    await executeBatchChunks(this.db, statements);
  }

  /**
   * 获取子空间列表
   * @param parentId 父空间 ID
   * @returns 子空间列表
   */
  async findSubspaces(parentId: string): Promise<Record<string, unknown>[]> {
    const { results } = await this.db
      .prepare(
        `
        SELECT s.*,
            COALESCE(sf_count.file_count, 0) as file_count,
            f.storage_key as cover_storage_key,
            ${this._productProjectionSQL()},
            ${this._variantImageProjectionSQL()}
        FROM spaces s
        ${this._spaceFileCountJoinSQL()}
        ${this._spaceProductJoinsSQL()}
        WHERE s.parent_id = ?
        ORDER BY s.sort_order ASC, s.updated_at DESC
      `
      )
      .bind(parentId)
      .all();
    return results;
  }

  /**
   * 获取销售员可见的子空间列表
   * @param parentId 父空间 ID
   * @param salespersonId 销售员 ID
   * @returns 子空间列表
   */
  async findSubspacesForSalesperson(parentId: string, salespersonId: string): Promise<Record<string, unknown>[]> {
    const now = Date.now();
    const { results } = await this.db
      .prepare(
        `
        SELECT s.*,
            COALESCE(sf_count.file_count, 0) as file_count,
            f.storage_key as cover_storage_key,
            ${this._productProjectionSQL()},
            ${this._variantImageProjectionSQL()}
        FROM spaces s
        ${this._spaceFileCountJoinSQL()}
        ${this._spaceProductJoinsSQL()}
        WHERE s.parent_id = ?
          AND ${this._nonExpiredSpaceWhereClause('s')}
          AND (
            s.share_mode = 'all'
            OR (s.share_mode = 'selected' AND EXISTS (
                SELECT 1 FROM space_salesperson_shares sss
                WHERE sss.space_id = s.id AND sss.salesperson_id = ?
            ))
          )
        ORDER BY s.sort_order ASC, s.updated_at DESC
      `
      )
      .bind(parentId, now, salespersonId)
      .all();

    return results;
  }

  /**
   * 创建子空间
   * @param data 子空间数据
   * @returns 创建结果
   */
  async createSubspace(data: CreateSubspaceData): Promise<{ id: string }> {
    await this.db
      .prepare(
        `
        INSERT INTO spaces (id, parent_id, name, description, is_public, password, share_token, expires_at, template, template_data, share_mode, product_id, variant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        data.id,
        data.parentId,
        data.name,
        data.description,
        data.isPublic ? 1 : 0,
        data.password,
        data.shareToken,
        data.expiresAt,
        data.template,
        data.templateData,
        data.shareMode || 'none',
        data.productId || null,
        data.variantId || null,
        data.createdAt,
        data.updatedAt
      )
      .run();

    return { id: data.id };
  }
  /**
   * 获取空间分享的销售员列表
   * @param id 空间 ID
   * @returns 销售员列表
   */
  async getSharedSalespersons(id: string): Promise<Array<{ id: string; name: string; store: string | null }>> {
    const { results } = await this.db
      .prepare(
        `
        SELECT sp.id, sp.name, sp.store
        FROM space_salesperson_shares sss
        JOIN salespersons sp ON sss.salesperson_id = sp.id
        WHERE sss.space_id = ?
      `
      )
      .bind(id)
      .all<{ id: string; name: string; store: string | null }>();
    return results || [];
  }

  /**
   * 更新空间分享的销售员列表
   * @param id 空间 ID
   * @param salespersonIds 销售员 ID 列表
   */
  async updateSharedSalespersons(id: string, salespersonIds: string[]): Promise<void> {
    const nowMs = Date.now();
    const batch = [this.db.prepare('DELETE FROM space_salesperson_shares WHERE space_id = ?').bind(id)];

    if (salespersonIds.length > 0) {
      const insertStmt = this.db.prepare(
        'INSERT INTO space_salesperson_shares (space_id, salesperson_id, shared_at) VALUES (?, ?, ?)'
      );
      salespersonIds.forEach((spId) => {
        batch.push(insertStmt.bind(id, spId, nowMs));
      });
    }

    await executeBatchChunks(this.db, batch);
  }

  /**
   * 获取销售员可见的共享空间列表
   * @param salespersonId 销售员 ID
   * @returns 空间列表
   */
  async findAllForSalesperson(salespersonId: string): Promise<Record<string, unknown>[]> {
    const now = Date.now();
    const { results } = await this.db.prepare(`
            SELECT s.*,
                COALESCE(sf_count.file_count, 0) as file_count,
                f.storage_key as cover_storage_key,
                ${this._productProjectionSQL()},
                ${this._variantImageProjectionSQL()}
            FROM spaces s
            ${this._spaceFileCountJoinSQL()}
            LEFT JOIN files f ON s.cover_file_id = f.id
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN product_variants pv ON s.variant_id = pv.id AND pv.product_id = s.product_id
            WHERE s.parent_id IS NULL
              AND ${this._nonExpiredSpaceWhereClause('s')}
              AND (
               s.share_mode = 'all'
               OR (s.share_mode = 'selected' AND EXISTS (
                   SELECT 1 FROM space_salesperson_shares sss
                   WHERE sss.space_id = s.id AND sss.salesperson_id = ?
               ))
              )
            ORDER BY s.updated_at DESC
        `).bind(now, salespersonId).all();
    return results;
  }

  /**
   * 获取销售员可见的空间详情
   * @param spaceId 空间 ID
   * @param salespersonId 销售员 ID
   * @returns 空间详情（含文件），不存在或无权限时返回 null
   */
  async findByIdForSalesperson(spaceId: string, salespersonId: string): Promise<Record<string, unknown> | null> {
    const now = Date.now();
    const space = await this.db.prepare(`
            SELECT s.*,
                f.storage_key as cover_storage_key,
                ${this._productProjectionSQL()},
                ${this._variantImageProjectionSQL()}
            FROM spaces s
            LEFT JOIN files f ON s.cover_file_id = f.id
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN product_variants pv ON s.variant_id = pv.id AND pv.product_id = s.product_id
            WHERE s.id = ?
              AND ${this._nonExpiredSpaceWhereClause('s')}
              AND (s.share_mode = 'all'
                   OR (s.share_mode = 'selected' AND EXISTS (
                       SELECT 1 FROM space_salesperson_shares sss
                       WHERE sss.space_id = s.id AND sss.salesperson_id = ?
                   )))
        `).bind(spaceId, now, salespersonId).first();

    if (!space) return null;

    const { results: files } = await this.db.prepare(`
            SELECT f.*, sf.section FROM files f
            JOIN space_files sf ON f.id = sf.file_id
            WHERE sf.space_id = ?
            ORDER BY sf.section, sf.sort_order ASC, f.created_at DESC
        `).bind(spaceId).all();

    return { ...space, files };
  }
}
