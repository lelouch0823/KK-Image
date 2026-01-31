/**
 * 文件夹仓库 (Folder Repository)
 * ===================================
 * 
 * 涉及文件夹的 CRUD、层级统计及物理存储清理关联逻辑。
 */

export class FolderRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 获取所有文件夹（极简列表，用于选择器）
     */
    async findAllMinimal() {
        const { results } = await this.db.prepare(
            'SELECT id, parent_id, name FROM folders ORDER BY name ASC'
        ).all();
        return results;
    }

    /**
     * 获取顶层文件夹列表（含子文件夹和文件计数）
     */
    async findTopLevel() {
        const { results } = await this.db.prepare(`
            SELECT f.*,
                COALESCE(sub.subfolder_count, 0) as subfolder_count,
                COALESCE(fc.file_count, 0) as file_count
            FROM folders f
            LEFT JOIN (
                SELECT parent_id, COUNT(*) as subfolder_count
                FROM folders
                GROUP BY parent_id
            ) sub ON sub.parent_id = f.id
            LEFT JOIN (
                SELECT folder_id, COUNT(*) as file_count
                FROM files
                GROUP BY folder_id
            ) fc ON fc.folder_id = f.id
            WHERE (f.parent_id IS NULL OR f.parent_id = 'root')
            ORDER BY f.created_at DESC
        `).all();
        return results;
    }

    /**
     * 获取子文件夹列表
     */
    async findByParent(parentId) {
        const { results } = await this.db.prepare(`
            SELECT f.*,
                COALESCE(sub.subfolder_count, 0) as subfolder_count,
                COALESCE(fc.file_count, 0) as file_count
            FROM folders f
            LEFT JOIN (
                SELECT parent_id, COUNT(*) as subfolder_count
                FROM folders
                GROUP BY parent_id
            ) sub ON sub.parent_id = f.id
            LEFT JOIN (
                SELECT folder_id, COUNT(*) as file_count
                FROM files
                GROUP BY folder_id
            ) fc ON fc.folder_id = f.id
            WHERE f.parent_id = ?
            ORDER BY f.created_at DESC
        `).bind(parentId).all();
        return results;
    }

    /**
     * 根据 ID 获取文件夹
     */
    async findById(id) {
        return await this.db.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first();
    }

    /**
     * 递归获取面包屑导航 (SOTA: 使用 WITH RECURSIVE 一次查询)
     */
    async getBreadcrumbs(folderId) {
        if (!folderId || folderId === 'root') return [];

        const { results } = await this.db.prepare(`
            WITH RECURSIVE ancestors AS (
                SELECT id, name, parent_id, 1 as depth
                FROM folders
                WHERE id = ?
                
                UNION ALL
                
                SELECT f.id, f.name, f.parent_id, a.depth + 1
                FROM folders f
                JOIN ancestors a ON f.id = a.parent_id
                WHERE a.parent_id IS NOT NULL AND a.parent_id != 'root'
            )
            SELECT id, name FROM ancestors ORDER BY depth DESC
        `).bind(folderId).all();

        return results.map(f => ({ id: f.id, name: f.name }));
    }

    /**
     * 创建文件夹
     */
    async create(data) {
        await this.db.prepare(
            `INSERT INTO folders (id, parent_id, name, description, share_token, is_public, password, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.id,
            data.parentId || null,
            data.name,
            data.description || '',
            data.shareToken || null,
            data.isPublic ? 1 : 0,
            data.password || null,
            data.createdAt || Date.now(),
            data.updatedAt || Date.now()
        ).run();
    }

    /**
     * 更新文件夹
     */
    async update(id, updates, values) {
        await this.db.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`)
            .bind(...values, id)
            .run();
    }

    /**
     * 递归获取目录下所有文件的存储 Key (SOTA: 使用 WITH RECURSIVE 一次查询)
     */
    async getAllStorageKeysRecursive(folderId) {
        const { results } = await this.db.prepare(`
            WITH RECURSIVE descendant_folders AS (
                SELECT id FROM folders WHERE id = ?
                
                UNION ALL
                
                SELECT f.id
                FROM folders f
                JOIN descendant_folders df ON f.parent_id = df.id
            )
            SELECT storage_key FROM files WHERE folder_id IN (SELECT id FROM descendant_folders)
        `).bind(folderId).all();

        return results.map(f => f.storage_key);
    }

    /**
     * 递归删除文件夹及其内容 (SOTA: 使用 WITH RECURSIVE + batch 一次删除)
     * 注意：此方法仅处理数据库，R2 清理需另行处理
     */
    async deleteRecursive(folderId) {
        // 获取所有后代文件夹 ID
        const { results: descendantIds } = await this.db.prepare(`
            WITH RECURSIVE descendant_folders AS (
                SELECT id FROM folders WHERE id = ?
                UNION ALL
                SELECT f.id FROM folders f JOIN descendant_folders df ON f.parent_id = df.id
            )
            SELECT id FROM descendant_folders
        `).bind(folderId).all();

        const ids = descendantIds.map(r => r.id);
        if (ids.length === 0) return;

        // 构建批量删除语句
        const filePlaceholders = ids.map(() => '?').join(',');
        const folderPlaceholders = ids.map(() => '?').join(',');

        await this.db.batch([
            this.db.prepare(`DELETE FROM files WHERE folder_id IN (${filePlaceholders})`).bind(...ids),
            this.db.prepare(`DELETE FROM folders WHERE id IN (${folderPlaceholders})`).bind(...ids)
        ]);
    }

    /**
     * 获取所有已分享的文件夹 (含分页)
     */
    async findShared({ page = 1, limit = 20 } = {}) {
        // 验证分页参数
        const safePage = Math.max(1, Math.floor(Number(page) || 1));
        const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
        const offset = (safePage - 1) * safeLimit;

        const totalResult = await this.db.prepare(
            'SELECT COUNT(*) as total FROM folders WHERE share_token IS NOT NULL'
        ).first();
        const total = totalResult?.total || 0;

        const { results } = await this.db.prepare(
            'SELECT * FROM folders WHERE share_token IS NOT NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?'
        ).bind(safeLimit, offset).all();

        return {
            items: results,
            total,
            page: safePage,
            limit: safeLimit,
            totalPages: Math.ceil(total / safeLimit)
        };
    }
}
