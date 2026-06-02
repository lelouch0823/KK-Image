import { buildSetClause } from '../api/utils/sql.js';

/**
 * 分类仓库 (Category Repository)
 * ===================================
 * 支持层级分类树结构，通过 parent_id 实现父子关系
 */

export class CategoryRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 获取所有分类（扁平列表）
     * @returns {Promise<Object[]>}
     */
    async findAll() {
        const { results } = await this.db.prepare(
            'SELECT id, name, parent_id, sort_order, created_at FROM categories ORDER BY sort_order ASC, name ASC'
        ).all();
        return results || [];
    }

    /**
     * 获取分类树结构（嵌套）
     * @returns {Promise<Object[]>} 根节点数组，每个节点包含 children
     */
    async getTree() {
        const flat = await this.findAll();
        return this._buildTree(flat);
    }

    /**
     * 将扁平列表构建为树结构
     * @param {Object[]} flat
     * @returns {Object[]}
     */
    _buildTree(flat) {
        const map = new Map();
        const roots = [];

        // 初始化 map
        for (const item of flat) {
            map.set(item.id, { ...item, children: [] });
        }

        // 构建父子关系
        for (const item of flat) {
            const node = map.get(item.id);
            if (item.parent_id && map.has(item.parent_id)) {
                map.get(item.parent_id).children.push(node);
            } else {
                roots.push(node);
            }
        }

        return roots;
    }

    /**
     * 根据 ID 查找分类
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const result = await this.db.prepare(
            'SELECT id, name, parent_id, sort_order, created_at FROM categories WHERE id = ?'
        ).bind(id).first();
        return result || null;
    }

    /**
     * 创建分类
     * @param {{ id: string, name: string, parentId?: string|null, sortOrder?: number, createdAt: number }} data
     * @returns {Promise<Object>}
     */
    async create(data) {
        await this.db.prepare(
            'INSERT INTO categories (id, name, parent_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
            data.id,
            data.name,
            data.parentId || null,
            data.sortOrder ?? 0,
            data.createdAt
        ).run();

        return {
            id: data.id,
            name: data.name,
            parent_id: data.parentId || null,
            sort_order: data.sortOrder ?? 0,
            created_at: data.createdAt,
        };
    }

    /**
     * 更新分类
     * @param {string} id
     * @param {{ name?: string, parentId?: string|null, sortOrder?: number }} updates
     * @returns {Promise<boolean>}
     */
    async update(id, updates) {
        // 防止循环引用：不能将自己设为自己的子节点
        if (updates.parentId !== undefined && updates.parentId === id) {
            throw new Error('不能将分类设为自己的子分类');
        }

        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
        if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

        if (Object.keys(dbUpdates).length === 0) return false;

        const { clause, values } = buildSetClause(dbUpdates);
        const result = await this.db.prepare(
            `UPDATE categories SET ${clause} WHERE id = ?`
        ).bind(...values, id).run();

        return result.meta?.changes > 0;
    }

    /**
     * 删除分类（级联删除子分类）
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const result = await this.db.prepare(
            'DELETE FROM categories WHERE id = ?'
        ).bind(id).run();
        return result.meta?.changes > 0;
    }

    /**
     * 获取指定分类下的商品 ID 列表
     * @param {string} categoryId
     * @returns {Promise<string[]>}
     */
    async getProductIds(categoryId) {
        const { results } = await this.db.prepare(
            'SELECT product_id FROM product_categories WHERE category_id = ?'
        ).bind(categoryId).all();
        return (results || []).map(r => r.product_id);
    }

    /**
     * 获取商品所属的分类 ID 列表
     * @param {string} productId
     * @returns {Promise<string[]>}
     */
    async getCategoryIdsByProduct(productId) {
        const { results } = await this.db.prepare(
            'SELECT category_id FROM product_categories WHERE product_id = ?'
        ).bind(productId).all();
        return (results || []).map(r => r.category_id);
    }

    /**
     * 设置分类下的商品（全量替换）
     * @param {string} categoryId
     * @param {string[]} productIds
     */
    async setProducts(categoryId, productIds) {
        // 先删除旧关联
        await this.db.prepare(
            'DELETE FROM product_categories WHERE category_id = ?'
        ).bind(categoryId).run();

        // 批量插入新关联
        if (productIds.length === 0) return;

        const stmts = productIds.map(productId =>
            this.db.prepare(
                'INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)'
            ).bind(productId, categoryId)
        );

        await this.db.batch(stmts);
    }

    /**
     * 设置商品的分类（全量替换）
     * @param {string} productId
     * @param {string[]} categoryIds
     */
    async setCategoriesForProduct(productId, categoryIds) {
        // 先删除旧关联
        await this.db.prepare(
            'DELETE FROM product_categories WHERE product_id = ?'
        ).bind(productId).run();

        // 批量插入新关联
        if (categoryIds.length === 0) return;

        const stmts = categoryIds.map(categoryId =>
            this.db.prepare(
                'INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)'
            ).bind(productId, categoryId)
        );

        await this.db.batch(stmts);
    }

    /**
     * 获取每个分类下的商品数量
     * @returns {Promise<Map<string, number>>}
     */
    async getProductCounts() {
        const { results } = await this.db.prepare(
            'SELECT category_id, COUNT(*) as count FROM product_categories GROUP BY category_id'
        ).all();
        const counts = new Map();
        for (const row of results || []) {
            counts.set(row.category_id, row.count);
        }
        return counts;
    }

    /**
     * 检查是否存在子分类
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async hasChildren(id) {
        const result = await this.db.prepare(
            'SELECT COUNT(*) as count FROM categories WHERE parent_id = ?'
        ).bind(id).first();
        return (result?.count || 0) > 0;
    }
}
