import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, now } from '../../_shared/utils.js';
import { BadRequestError, ConflictError } from '../../errors.js';
import { TagRepository } from '../../../../repositories/TagRepository.js';
import { withCache, invalidateCache } from '../../middleware/cache.js';
import { getManageTagCacheUrls } from '../_shared/cache-urls.js';

const tagsRoute = new Hono();

// GET 获取所有标签
tagsRoute.get('/', requirePermission('files:read'), withCache(30), async (c) => {
    const repo = new TagRepository(c.env.DB);
    const results = await repo.findAll();
    return c.json({ success: true, tags: results });
});

// POST 创建标签
tagsRoute.post('/', requirePermission('files:write'), async (c) => {
    const { name, color } = await c.req.json();
    if (!name || name.trim() === '') {
        throw new BadRequestError('Name is required');
    }

    const id = generateId();
    const repo = new TagRepository(c.env.DB);

    // 保留 try-catch 用于区分 UNIQUE 约束冲突
    try {
        await repo.create({ id, name: name.trim(), color, createdAt: now() });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            throw new ConflictError('Tag already exists');
        }
        throw error;
    }

    c.executionCtx.waitUntil(invalidateCache(getManageTagCacheUrls(c)));

    return c.json({ success: true, tag: { id, name: name.trim(), color } });
});

// POST 分配标签到文件
tagsRoute.post('/assign', requirePermission('files:write'), async (c) => {
    const { file_id, tag_id } = await c.req.json();
    if (!file_id || !tag_id) throw new BadRequestError('Missing IDs');

    const repo = new TagRepository(c.env.DB);
    await repo.assignToFile({ fileId: file_id, tagId: tag_id, createdAt: now() });
    c.executionCtx.waitUntil(invalidateCache(getManageTagCacheUrls(c)));
    return c.json({ success: true });
});

// DELETE 从文件移除标签
tagsRoute.delete('/assign', requirePermission('files:write'), async (c) => {
    const { file_id, tag_id } = await c.req.json();

    const repo = new TagRepository(c.env.DB);
    await repo.removeFromFile(file_id, tag_id);
    c.executionCtx.waitUntil(invalidateCache(getManageTagCacheUrls(c)));
    return c.json({ success: true });
});

export default tagsRoute;
