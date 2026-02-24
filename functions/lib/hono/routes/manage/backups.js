import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { MSG } from '../../_shared/utils.js';
import { NotFoundError } from '../../errors.js';

const app = new Hono();

/**
 * GET / - 列出所有备份
 */
app.get('/', requirePermission('admin:full'), async (c) => {
    const { env } = c;

    // 列出 R2_BACKUP_BUCKET 中的文件
    const list = await env.R2_BACKUP_BUCKET.list();

    const backups = list.objects
        .map((obj) => ({
            name: obj.key,
            size: obj.size,
            uploadedAt: obj.uploaded.toISOString(),
            key: obj.key,
        }))
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return c.json({ success: true, data: backups });
});

/**
 * POST / - 创建新备份
 */
app.post('/', requirePermission('admin:full'), async (c) => {
    const { env } = c;
    const { performStreamingBackup } = await import('../../../../api/utils/backup-utils.js');
    const { filename, key } = await performStreamingBackup(env);

    return c.json({
        success: true,
        message: MSG.COMMON.OP_SUCCESS,
        data: {
            filename,
            key,
            size: 0,
            note: 'Backup created successfully',
        }
    });
});

/**
 * GET /[filename] - 下载备份
 */
app.get('/:filename', requirePermission('admin:full'), async (c) => {
    const { env } = c;
    const filename = c.req.param('filename');
    const object = await env.R2_BACKUP_BUCKET.get(filename);

    if (!object) throw new NotFoundError(MSG.COMMON.NOT_FOUND);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new Response(object.body, { headers });
});

/**
 * DELETE /[filename] - 删除备份
 */
app.delete('/:filename', requirePermission('admin:full'), async (c) => {
    const { env } = c;
    const filename = c.req.param('filename');
    await env.R2_BACKUP_BUCKET.delete(filename);
    return c.json({ success: true, message: MSG.COMMON.DELETE_SUCCESS });
});

export default app;
