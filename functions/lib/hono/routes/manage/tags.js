import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, now } from '../../../../api/utils/id.js';

const tagsRoute = new Hono();

// GET all tags
tagsRoute.get('/', requirePermission('read'), async (c) => {
    try {
        const { results } = await c.env.DB.prepare(`SELECT * FROM tags ORDER BY name ASC`).all();
        return c.json({ success: true, tags: results });
    } catch (_error) {
        return c.json({ success: false, error: 'Failed to fetch tags' }, 500);
    }
});

// POST to create a global tag
tagsRoute.post('/', requirePermission('write'), async (c) => {
    const { name, color } = await c.req.json();
    if (!name || name.trim() === '') {
        return c.json({ success: false, error: 'Name is required' }, 400);
    }

    try {
        const id = generateId();
        await c.env.DB.prepare(`INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`)
            .bind(id, name.trim(), color || null, now())
            .run();
        return c.json({ success: true, tag: { id, name: name.trim(), color } });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return c.json({ success: false, error: 'Tag already exists' }, 409);
        }
        return c.json({ success: false, error: 'Failed to create tag' }, 500);
    }
});

// POST to assign a tag to a file
tagsRoute.post('/assign', requirePermission('write'), async (c) => {
    const { file_id, tag_id } = await c.req.json();
    if (!file_id || !tag_id) return c.json({ success: false, error: 'Missing IDs' }, 400);

    try {
        await c.env.DB.prepare(`INSERT INTO file_tags (file_id, tag_id, created_at) VALUES (?, ?, ?)`)
            .bind(file_id, tag_id, now())
            .run();
        return c.json({ success: true });
    } catch (_error) {
        return c.json({ success: false, error: 'Failed to assign tag' }, 500);
    }
});

// DELETE tag from a file
tagsRoute.delete('/assign', requirePermission('write'), async (c) => {
    const { file_id, tag_id } = await c.req.json();

    try {
        await c.env.DB.prepare(`DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?`)
            .bind(file_id, tag_id)
            .run();
        return c.json({ success: true });
    } catch (_error) {
        return c.json({ success: false, error: 'Failed to remove tag' }, 500);
    }
});

export default tagsRoute;
