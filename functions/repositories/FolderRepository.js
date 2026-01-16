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
                (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
                (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
            FROM folders f 
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
                (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
                (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
            FROM folders f 
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
     * 递归获取面包屑导航
     */
    async getBreadcrumbs(folderId) {
        const breadcrumbs = [];
        let currentId = folderId;

        while (currentId && currentId !== 'root') {
            const folder = await this.db.prepare('SELECT id, name, parent_id FROM folders WHERE id = ?')
                .bind(currentId).first();
            if (!folder) break;
            breadcrumbs.unshift({ id: folder.id, name: folder.name });
            currentId = folder.parent_id;
        }

        return breadcrumbs;
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
     * 递归获取目录下所有文件的存储 Key (用于 R2 清理)
     */
    async getAllStorageKeysRecursive(folderId) {
        let keys = [];

        // 1. 获取当前目录文件
        const { results: files } = await this.db.prepare('SELECT storage_key FROM files WHERE folder_id = ?')
            .bind(folderId).all();
        keys = keys.concat(files.map(f => f.storage_key));

        // 2. 获取子目录
        const { results: subfolders } = await this.db.prepare('SELECT id FROM folders WHERE parent_id = ?')
            .bind(folderId).all();

        for (const sub of subfolders) {
            const subKeys = await this.getAllStorageKeysRecursive(sub.id);
            keys = keys.concat(subKeys);
        }

        return keys;
    }

    /**
     * 递归删除文件夹及其内容
     * 注意：此方法仅处理数据库，R2 清理需另行处理
     */
    async deleteRecursive(folderId) {
        const { results: subfolders } = await this.db.prepare('SELECT id FROM folders WHERE parent_id = ?')
            .bind(folderId).all();

        for (const sub of subfolders) {
            await this.deleteRecursive(sub.id);
        }

        await this.db.batch([
            this.db.prepare('DELETE FROM files WHERE folder_id = ?').bind(folderId),
            this.db.prepare('DELETE FROM folders WHERE id = ?').bind(folderId)
        ]);
    }

    /**
     * 获取所有已分享的文件夹 (含分页)
     */
    async findShared({ page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;
        const totalResult = await this.db.prepare(
            'SELECT COUNT(*) as total FROM folders WHERE share_token IS NOT NULL'
        ).first();
        const total = totalResult?.total || 0;

        const { results } = await this.db.prepare(
            'SELECT * FROM folders WHERE share_token IS NOT NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?'
        ).bind(limit, offset).all();

        return {
            items: results,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
}
