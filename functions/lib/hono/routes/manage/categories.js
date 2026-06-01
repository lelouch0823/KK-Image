import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CategoryRepository } from '../../../../repositories/CategoryRepository.js';
import { requirePermission } from '../../../middleware/auth.js';
import { generateId, now } from '../../../../_shared/utils.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../../errors.js';
import { withCache } from '../../../middleware/cache.js';
import {
    CreateCategorySchema,
    UpdateCategorySchema,
    SetCategoryProductsSchema,
    SetProductCategoriesSchema,
} from '../../../schemas/category.js';

const categoriesRoute = new Hono();
categoriesRoute.use('*', requirePermission('products:manage'));

// GET / - 获取所有分类（支持 ?mode=tree 返回树结构）
categoriesRoute.get('/', withCache(30), async (c) => {
    const repo = new CategoryRepository(c.env.DB);
    const mode = c.req.query('mode');

    if (mode === 'tree') {
        const tree = await repo.getTree();
        return c.json({ success: true, data: tree });
    }

    const results = await repo.findAll();
    const counts = await repo.getProductCounts();

    // 附加商品数量
    const data = results.map(item => ({
        ...item,
        product_count: counts.get(item.id) || 0,
    }));

    return c.json({ success: true, data });
});

// POST / - 创建分类
categoriesRoute.post('/', zValidator('json', CreateCategorySchema), async (c) => {
    const { name, parent_id, sort_order } = c.req.valid('json');
    const repo = new CategoryRepository(c.env.DB);

    // 验证父分类存在
    if (parent_id) {
        const parent = await repo.findById(parent_id);
        if (!parent) {
            throw new NotFoundError('父分类不存在');
        }
    }

    const id = generateId();
    const category = await repo.create({
        id,
        name: name.trim(),
        parentId: parent_id || null,
        sortOrder: sort_order,
        createdAt: now(),
    });

    return c.json({ success: true, data: category });
});

// GET /:id - 获取单个分类
categoriesRoute.get('/:id', async (c) => {
    const repo = new CategoryRepository(c.env.DB);
    const category = await repo.findById(c.req.param('id'));
    if (!category) {
        throw new NotFoundError('分类不存在');
    }
    return c.json({ success: true, data: category });
});

// PATCH /:id - 更新分类
categoriesRoute.patch('/:id', zValidator('json', UpdateCategorySchema), async (c) => {
    const { name, parent_id, sort_order } = c.req.valid('json');
    const id = c.req.param('id');
    const repo = new CategoryRepository(c.env.DB);

    const existing = await repo.findById(id);
    if (!existing) {
        throw new NotFoundError('分类不存在');
    }

    // 验证父分类存在
    if (parent_id) {
        const parent = await repo.findById(parent_id);
        if (!parent) {
            throw new NotFoundError('父分类不存在');
        }
    }

    try {
        await repo.update(id, {
            name: name?.trim(),
            parentId: parent_id,
            sortOrder: sort_order,
        });
    } catch (error) {
        if (error.message.includes('不能将分类设为自己的子分类')) {
            throw new BadRequestError(error.message);
        }
        throw error;
    }

    const updated = await repo.findById(id);
    return c.json({ success: true, data: updated });
});

// DELETE /:id - 删除分类
categoriesRoute.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const repo = new CategoryRepository(c.env.DB);

    const existing = await repo.findById(id);
    if (!existing) {
        throw new NotFoundError('分类不存在');
    }

    await repo.delete(id);
    return c.json({ success: true });
});

// GET /:id/products - 获取分类下的商品 ID 列表
categoriesRoute.get('/:id/products', async (c) => {
    const id = c.req.param('id');
    const repo = new CategoryRepository(c.env.DB);

    const existing = await repo.findById(id);
    if (!existing) {
        throw new NotFoundError('分类不存在');
    }

    const productIds = await repo.getProductIds(id);
    return c.json({ success: true, data: productIds });
});

// POST /:id/products - 设置分类下的商品（全量替换）
categoriesRoute.post('/:id/products', zValidator('json', SetCategoryProductsSchema), async (c) => {
    const id = c.req.param('id');
    const { product_ids } = c.req.valid('json');
    const repo = new CategoryRepository(c.env.DB);

    const existing = await repo.findById(id);
    if (!existing) {
        throw new NotFoundError('分类不存在');
    }

    await repo.setProducts(id, product_ids);
    return c.json({ success: true });
});

// GET /product/:productId - 获取商品所属的分类
categoriesRoute.get('/product/:productId', async (c) => {
    const productId = c.req.param('productId');
    const repo = new CategoryRepository(c.env.DB);
    const categoryIds = await repo.getCategoryIdsByProduct(productId);
    return c.json({ success: true, data: categoryIds });
});

// POST /product/:productId - 设置商品的分类（全量替换）
categoriesRoute.post('/product/:productId', zValidator('json', SetProductCategoriesSchema), async (c) => {
    const productId = c.req.param('productId');
    const { category_ids } = c.req.valid('json');
    const repo = new CategoryRepository(c.env.DB);

    await repo.setCategoriesForProduct(productId, category_ids);
    return c.json({ success: true });
});

export default categoriesRoute;
