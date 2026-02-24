import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, now } from '../../../../api/utils/id.js';
import { BadRequestError, ConflictError } from '../../errors.js';

const tagsRoute = new Hono();

// GET 获取所有标签
tagsRoute.get('/', requirePermission('read'), async (c) => {
    const { results } = await c.env.DB.prepare(`SELECT * FROM tags ORDER BY name ASC`).all();
    return c.json({ success: true, tags: results });
});

// POST 创建标签
tagsRoute.post('/', requirePermission('write'), async (c) => {
    const { name, color } = await c.req.json();
    if (!name || name.trim() === '') {
        throw new BadRequestError('Name is required');
    }

    const id = generateId();

    // 保留 try-catch 用于区分 UNIQUE 约束冲突
    try {
        await c.env.DB.prepare(`INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`)
            .bind(id, name.trim(), color || null, now())
            .run();
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            throw new ConflictError('Tag already exists');
        }
        throw error; // 非 UNIQUE 错误继续冒泡到全局处理器
    }

    return c.json({ success: true, tag: { id, name: name.trim(), color } });
});

// POST 分配标签到文件
tagsRoute.post('/assign', requirePermission('write'), async (c) => {
    const { file_id, tag_id } = await c.req.json();
    if (!file_id || !tag_id) throw new BadRequestError('Missing IDs');

    await c.env.DB.prepare(`INSERT INTO file_tags (file_id, tag_id, created_at) VALUES (?, ?, ?)`)
        .bind(file_id, tag_id, now())
        .run();
    return c.json({ success: true });
});

// DELETE 从文件移除标签
tagsRoute.delete('/assign', requirePermission('write'), async (c) => {
    const { file_id, tag_id } = await c.req.json();

    await c.env.DB.prepare(`DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?`)
        .bind(file_id, tag_id)
        .run();
    return c.json({ success: true });
});

export default tagsRoute;
