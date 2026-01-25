import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { ProductRepository } from '../../../repositories/ProductRepository.js';

const app = new Hono().basePath('/api/manage/products');

app.get('/', async (c) => {
    const { env } = c;
    const { search, category, brand, status, page = 1, limit = 20 } = c.req.query();

    const repo = new ProductRepository(env.DB);
    const result = await repo.search({
        search,
        category,
        brand,
        status,
        page: parseInt(page),
        limit: parseInt(limit)
    });

    return c.json({
        success: true,
        data: result.items,
        meta: {
            total: result.total,
            page: parseInt(page),
            limit: parseInt(limit)
        }
    });
});

app.post('/', async (c) => {
    const { env } = c;
    const body = await c.req.json();

    if (!body.name || !body.sku) {
        return c.json({ success: false, error: 'Name and SKU are required' }, 400);
    }

    const repo = new ProductRepository(env.DB);

    // Check SKU uniqueness
    const existing = await repo.findBySku(body.sku);
    if (existing) {
        return c.json({ success: false, error: 'SKU already exists' }, 409);
    }

    try {
        const product = await repo.create(body);
        return c.json({ success: true, data: product });
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

export const onRequest = handle(app);
