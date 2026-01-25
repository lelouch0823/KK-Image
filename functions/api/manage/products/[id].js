
import { Hono } from 'hono';
import { ProductRepository } from '../../../repositories/ProductRepository.js';

const app = new Hono();

app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    // Find by ID directly via DB prepare since Repository doesn't have findById in v1 (it has findBySku)
    // Actually let's add findById to repo if needed or just use DB
    // Or better, let's implement findById on the fly or just use raw query here for speed
    // But good practice is to use Repo. Let's assume I'll add findById or just use DB here.
    // Wait, the plan said "Methods: create, findById..." so I should have implemented it.
    // I missed findById in the initial ProductRepository.js code! I drafted it but maybe missed it.
    // Let me implement it inline here for now or fix the repo. 
    // Actually I'll fix the repo in a subsequent step if it's missing, but for now I'll use DB directly.

    const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();

    if (!product) {
        return c.json({ success: false, error: 'Product not found' }, 404);
    }

    try {
        product.images = JSON.parse(product.images || '[]');
        product.specifications = JSON.parse(product.specifications || '{}');
    } catch {
        // ignore json error
    }

    return c.json({ success: true, data: product });
});

app.patch('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const body = await c.req.json();

    const repo = new ProductRepository(env.DB);

    // Check if exists
    // (Optimization: updated() returns false if not found usually, or we search first)

    try {
        const success = await repo.update(id, body);
        if (!success) {
            return c.json({ success: false, error: 'Product not found or update failed' }, 404);
        }
        return c.json({ success: true, message: 'Product updated' });
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    // Check if linked to orders?
    // Foreign key set to SET NULL so deletion is safe but maybe we want to warn?
    // For now simple delete.

    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();

    return c.json({ success: true, message: 'Product deleted' });
});

export default app;
