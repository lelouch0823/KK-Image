import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';

/**
 * 共享空间仓库 (Space Repository)
 * ===================================
 *
 * 负责共享空间 (Spaces) 及其关联文件 (Space Files) 的数据库操作。
 * 遵循 SOTA 模式，集成真实的统计查询逻辑。
 */

export class SpaceRepository {
    constructor(db) {
        this.db = db;
    }

    _productProjectionSQL() {
        return `
          p.spu as p_sku,
          p.brand as p_brand,
          p.series as p_series,
          COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price,
          p.specifications as p_specs,
          p.images as p_images,
          pv.sku as pv_sku,
          pv.price as pv_price,
          pv.options_values as pv_options_values
        `;
    }

    _variantImageProjectionSQL() {
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

    _spaceFileCountJoinSQL() {
        return `
        LEFT JOIN (
            SELECT space_id, COUNT(*) as file_count
            FROM space_files
            GROUP BY space_id
        ) sf_count ON sf_count.space_id = s.id
      `;
    }

    _spaceProductJoinsSQL() {
        return `
        LEFT JOIN files f ON s.cover_file_id = f.id
        LEFT JOIN products p ON s.product_id = p.id
        LEFT JOIN product_variants pv ON s.variant_id = pv.id
      `;
    }

    /**
     * 获取空间列表 (含封面和文件数)
     * @returns {Promise<Array>}
     */
    async findAll() {
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
        ORDER BY s.updated_at DESC
      `
            )
            .all();
        return results;
    }

    /**
     * 根据 Product ID 获取相关空间列表
     * @param {string} productId
     * @returns {Promise<Array>}
     */
    async findByProductId(productId) {
        const { results } = await this.db
            .prepare(
                `
        SELECT s.*,
          COALESCE(sf_count.file_count, 0) as file_count,
          f.storage_key as cover_storage_key,
          ${this._variantImageProjectionSQL()}
        FROM spaces s
        ${this._spaceFileCountJoinSQL()}
        ${this._spaceProductJoinsSQL()}
        WHERE s.product_id = ?
        ORDER BY s.updated_at DESC
      `
            )
            .bind(productId)
            .all();
        return results;
    }

    /**
     * 根据 ID 获取空间详情
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        return await this.db.prepare(`
            SELECT s.*,
              ${this._variantImageProjectionSQL()},
              ${this._productProjectionSQL()}
            FROM spaces s
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN product_variants pv ON s.variant_id = pv.id
            WHERE s.id = ?
        `).bind(id).first();
    }

    /**
     * 获取空间及其文件列表
     * @param {string} id
     * @returns {Promise<Object>} { space, files }
     */
    async getWithFiles(id) {
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
     * @param {string} id
     * @param {number} days - 趋势天数
     * @param {number} startTimestamp - 统计起始时间戳 (UTC)
     * @returns {Promise<Object>}
     */
    async getStats(id, days, startTimestamp) {
        const space = await this.db
            .prepare('SELECT view_count, download_count FROM spaces WHERE id = ?')
            .bind(id)
            .first();

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
            .first();

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
            .all();

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
     * @param {Object} data - Space data object
     * @returns {Promise<void>}
     */
    async create(data) {
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
    }

    /**
     * 更新空间
     * @param {string} id
     * @param {Array} updates - SQL update clauses
     * @param {Array} values - SQL update values
     * @returns {Promise<void>}
     */
    async update(id, updates, values) {
        await this.db
            .prepare(`UPDATE spaces SET ${updates.join(', ')} WHERE id = ?`)
            .bind(...values)
            .run();

        return await this.findById(id);
    }

    /**
     * 删除空间 (Transaction)
     * @param {string} id
     * @returns {Promise<void>}
     */
    async delete(id) {
        await this.db.batch([
            this.db.prepare('DELETE FROM space_files WHERE space_id = ?').bind(id),
            this.db.prepare('DELETE FROM spaces WHERE id = ?').bind(id),
        ]);
    }

    /**
     * 添加文件到空间
     * @param {string} spaceId
     * @param {Array<string>} fileIds
     * @returns {Promise<void>}
     */
    async addFiles(spaceId, fileIds) {
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
     * @param {string} spaceId
     * @param {Array<string>} fileIds
     * @returns {Promise<void>}
     */
    async removeFiles(spaceId, fileIds) {
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
     * @param {string} spaceId
     * @param {Array<string>} fileIds - Sorted list of file IDs
     * @returns {Promise<void>}
     */
    async reorderFiles(spaceId, fileIds) {
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
     * @param {string} parentId
     * @returns {Promise<Array>}
     */
    async findSubspaces(parentId) {
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
     * @param {string} parentId
     * @param {string} salespersonId
     * @returns {Promise<Array>}
     */
    async findSubspacesForSalesperson(parentId, salespersonId) {
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
            .bind(parentId, salespersonId)
            .all();

        return results;
    }

    /**
     * 创建子空间
     * @param {Object} data
     * @returns {Promise<void>}
     */
    async createSubspace(data) {
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
    }
    /**
     * 获取空间分享的销售员列表
     * @param {string} id
     * @returns {Promise<Array>}
     */
    async getSharedSalespersons(id) {
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
            .all();
        return results || [];
    }

    /**
     * 更新空间分享的销售员列表
     * @param {string} id
     * @param {Array<string>} salespersonIds
     * @returns {Promise<void>}
     */
    async updateSharedSalespersons(id, salespersonIds) {
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
     * @param {string} salespersonId
     * @returns {Promise<Array>}
     */
    async findAllForSalesperson(salespersonId) {
        const { results } = await this.db.prepare(`
            SELECT s.*, 
                (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count,
                f.storage_key as cover_storage_key,
                ${this._productProjectionSQL()},
                ${this._variantImageProjectionSQL()}
            FROM spaces s
            LEFT JOIN files f ON s.cover_file_id = f.id
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN product_variants pv ON s.variant_id = pv.id
            WHERE s.share_mode = 'all'
               OR (s.share_mode = 'selected' AND EXISTS (
                   SELECT 1 FROM space_salesperson_shares sss 
                   WHERE sss.space_id = s.id AND sss.salesperson_id = ?
               ))
            ORDER BY s.updated_at DESC
        `).bind(salespersonId).all();
        return results;
    }

    /**
     * 获取销售员可见的空间详情
     * @param {string} spaceId
     * @param {string} salespersonId
     * @returns {Promise<Object|null>}
     */
    async findByIdForSalesperson(spaceId, salespersonId) {
        const space = await this.db.prepare(`
            SELECT s.*,
                f.storage_key as cover_storage_key,
                ${this._productProjectionSQL()},
                ${this._variantImageProjectionSQL()}
            FROM spaces s
            LEFT JOIN files f ON s.cover_file_id = f.id
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN product_variants pv ON s.variant_id = pv.id
            WHERE s.id = ?
              AND (s.share_mode = 'all'
                   OR (s.share_mode = 'selected' AND EXISTS (
                       SELECT 1 FROM space_salesperson_shares sss 
                       WHERE sss.space_id = s.id AND sss.salesperson_id = ?
                   )))
        `).bind(spaceId, salespersonId).first();

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
