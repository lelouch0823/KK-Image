import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';

const app = new Hono();

/**
 * GET /:id - 获取商品详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    // Simple fetch without Repo for now as Repo doesn't have findById yet
    // const repo = new ProductRepository(env.DB);

    // ProductRepository requires custom method or we reuse search by ID if available (likely need dedicated method)
    // For now, let's assume search can filter enough or add findById
    // Actually repo has findBySku but not explicit findById in snippet.
    // Let's rely on basic DB fetch for now or extend Repo in next step if needed. 
    // Checking previous file content... Repo doesn't have findById. 
    // Wait, let's implement a quick fetch here or add to Repo.
    // Adding to Repo is SOTA. 

    const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();

    if (!product) {
        return c.json({ success: false, error: 'Product not found' }, 404);
    }

    // Reuse parsing logic? Repo has _parseResult.
    // Let's manually parse for now to keep it simple, or import utils.
    try {
        product.images = JSON.parse(product.images || '[]');
        product.specifications = JSON.parse(product.specifications || '{}');
    } catch (_e) {
        // ignore
    }

    return c.json({ success: true, data: product });
});

/**
 * PUT /:id - 更新商品
 */
app.put('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const body = await c.req.json();
    const repo = new ProductRepository(env.DB);

    const success = await repo.update(id, body);

    if (success) {
        return c.json({ success: true, message: 'Product updated' });
    } else {
        return c.json({ success: false, error: 'Update failed or no changes' }, 400);
    }
});

/**
 * DELETE /:id - 删除商品 (Mock, usually archive)
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new ProductRepository(env.DB);

    // Soft delete usually
    const success = await repo.update(id, { status: 'archived' });

    if (success) {
        return c.json({ success: true, message: 'Product archived' });
    } else {
        return c.json({ success: false, error: 'Delete failed' }, 400);
    }
});

export default app;
