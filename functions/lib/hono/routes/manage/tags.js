import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, now } from '../../../../_shared/utils.js';
import { ConflictError } from '../../errors.js';
import { TagRepository } from '../../../../repositories/TagRepository.ts';
import { withCache } from '../../middleware/cache.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';
import { CreateTagSchema, AssignTagSchema } from '../../schemas/tag.js';

const tagsRoute = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'tags', action: 'tag.create', severity: 'normal', targetType: 'tag' },
    { method: 'POST', path: '/assign', domain: 'tags', action: 'tag.assign', severity: 'normal', targetType: 'tag' },
    { method: 'DELETE', path: '/assign', domain: 'tags', action: 'tag.unassign', severity: 'normal', targetType: 'tag' },
]);

/**
 * GET /suggest - 标签名称搜索建议（轻量级）
 */
tagsRoute.get('/suggest', requirePermission('files:read'), async (c) => {
    const q = c.req.query('q') || '';
    const limit = Math.min(Number(c.req.query('limit')) || 10, 20);

    if (!q.trim()) {
        return c.json({ success: true, data: [] });
    }

    const repo = new TagRepository(c.env.DB);
    const data = await repo.suggest(q, limit);

    return c.json({ success: true, data });
});

// GET 获取所有标签
tagsRoute.get('/', requirePermission('files:read'), withCache(30), async (c) => {
    const repo = new TagRepository(c.env.DB);
    const results = await repo.findAll();
    return c.json({ success: true, data: results });
});

// POST 创建标签
tagsRoute.post('/', requirePermission('files:write'), zValidator('json', CreateTagSchema), async (c) => {
    const { name, color } = c.req.valid('json');

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

    await publishSingleDomainEventAndPoll(c, {
        event_type: 'tag_created',
        aggregate_type: 'tag',
        aggregate_id: id,
        payload: {
            tag_id: id,
        },
    }, `tag-create:${id}`);
    scheduleAuditEvent(c, {
        domain: 'tags',
        action: 'tag.create',
        result: 'success',
        severity: 'normal',
        targetType: 'tag',
        targetId: id,
        target_label: name.trim(),
        summary: `Created tag ${name.trim()}`,
    });

    return c.json({ success: true, data: { id, name: name.trim(), color } });
});

// POST 分配标签到文件
tagsRoute.post('/assign', requirePermission('files:write'), zValidator('json', AssignTagSchema), async (c) => {
    const { file_id, tag_id } = c.req.valid('json');

    const repo = new TagRepository(c.env.DB);
    await repo.assignToFile({ fileId: file_id, tagId: tag_id, createdAt: now() });
    await publishSingleDomainEventAndPoll(c, {
        event_type: 'tag_assigned_to_file',
        aggregate_type: 'tag',
        aggregate_id: tag_id,
        payload: {
            tag_id,
            file_id,
        },
    }, `tag-assign:${tag_id}:${file_id}`);
    scheduleAuditEvent(c, {
        domain: 'tags',
        action: 'tag.assign',
        result: 'success',
        severity: 'normal',
        targetType: 'tag',
        targetId: tag_id,
        target_label: tag_id,
        summary: `Assigned tag ${tag_id} to file ${file_id}`,
    });
    return c.json({ success: true });
});

// DELETE 从文件移除标签
tagsRoute.delete('/assign', requirePermission('files:write'), zValidator('json', AssignTagSchema), async (c) => {
    const { file_id, tag_id } = c.req.valid('json');

    const repo = new TagRepository(c.env.DB);
    await repo.removeFromFile(file_id, tag_id);
    await publishSingleDomainEventAndPoll(c, {
        event_type: 'tag_unassigned_from_file',
        aggregate_type: 'tag',
        aggregate_id: tag_id,
        payload: {
            tag_id,
            file_id,
        },
    }, `tag-unassign:${tag_id}:${file_id}`);
    scheduleAuditEvent(c, {
        domain: 'tags',
        action: 'tag.unassign',
        result: 'success',
        severity: 'normal',
        targetType: 'tag',
        targetId: tag_id,
        target_label: tag_id,
        summary: `Removed tag ${tag_id} from file ${file_id}`,
    });
    return c.json({ success: true });
});

export default tagsRoute;
