import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { MSG } from '../../../../_shared/utils.js';
import { ForbiddenError, NotFoundError } from '../../errors.js';
import { requireEntity } from '../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { BackupRestoreService } from '../../../../services/BackupRestoreService.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'backups', action: 'backup.create', severity: 'critical', targetType: 'backup', runtimeAssertionLevel: 'runtime', highRisk: true },
    { method: 'POST', path: '/:filename/validate', domain: 'backups', action: 'backup.restore.validate', severity: 'high', targetType: 'backup' },
    { method: 'POST', path: '/:filename/dry-run', domain: 'backups', action: 'backup.restore.dry_run', severity: 'high', targetType: 'backup' },
    { method: 'POST', path: '/:filename/restore', domain: 'backups', action: 'backup.restore.execute', severity: 'critical', targetType: 'backup', runtimeAssertionLevel: 'runtime', highRisk: true },
    { method: 'DELETE', path: '/:filename', domain: 'backups', action: 'backup.delete', severity: 'critical', targetType: 'backup', highRisk: true },
]);

function buildRestoreAuditMetadata(result, extras = {}) {
    return {
        allowed: result.allowed,
        environment: result.environment,
        branch: result.branch,
        mode: result.mode,
        dryRun: Boolean(result.dryRun),
        restoreMode: result.restoreMode || null,
        ...extras,
    };
}

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
    scheduleAuditEvent(c, {
        domain: 'backups',
        action: 'backup.create',
        result: 'success',
        severity: 'critical',
        targetType: 'backup',
        targetId: key,
        target_label: filename,
        summary: `Created backup ${filename}`,
    });

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
    // 路径遍历防护：仅允许字母、数字、连字符、下划线、点号
    if (!/^[a-zA-Z0-9_.\-]+$/.test(filename) || filename.includes('..')) {
        throw new BadRequestError('无效的文件名');
    }
    const object = await requireEntity(
        env.R2_BACKUP_BUCKET.get(filename),
        () => new NotFoundError(MSG.COMMON.NOT_FOUND)
    );

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new Response(object.body, { headers });
});

/**
 * POST /:filename/validate - 校验备份是否可用于恢复规划
 */
app.post('/:filename/validate', requirePermission('admin:full'), async (c) => {
    const filename = c.req.param('filename');
    const service = new BackupRestoreService(c.env);
    const result = await service.validateBackup(filename);

    scheduleAuditEvent(c, {
        domain: 'backups',
        action: 'backup.restore.validate',
        result: 'success',
        severity: 'high',
        targetType: 'backup',
        targetId: filename,
        target_label: filename,
        summary: `Validated backup ${filename} for restore planning`,
        metadata: buildRestoreAuditMetadata(result),
    });

    return c.json({ success: true, data: result });
});

/**
 * POST /:filename/dry-run - 返回恢复预演摘要
 */
app.post('/:filename/dry-run', requirePermission('admin:full'), async (c) => {
    const filename = c.req.param('filename');
    const user = c.get('user');
    const service = new BackupRestoreService(c.env);
    const result = await service.dryRunRestore(filename, { requestedBy: user?.id || null });

    scheduleAuditEvent(c, {
        domain: 'backups',
        action: 'backup.restore.dry_run',
        result: 'success',
        severity: 'high',
        targetType: 'backup',
        targetId: filename,
        target_label: filename,
        summary: `Prepared restore dry run for ${filename}`,
        metadata: buildRestoreAuditMetadata(result, { requestedBy: user?.id || null }),
    });

    return c.json({ success: true, data: result });
});

/**
 * POST /:filename/restore - 执行受控恢复（当前仅输出审计摘要）
 */
app.post('/:filename/restore', requirePermission('admin:full'), async (c) => {
    const filename = c.req.param('filename');
    const user = c.get('user');
    const service = new BackupRestoreService(c.env);
    const validation = await service.validateBackup(filename);

    if (!validation.allowed) {
        scheduleAuditEvent(c, {
            domain: 'backups',
            action: 'backup.restore.execute',
            result: 'denied',
            severity: 'critical',
            targetType: 'backup',
            targetId: filename,
            target_label: filename,
            summary: `Blocked restore execution for ${filename}`,
            metadata: buildRestoreAuditMetadata(validation, { requestedBy: user?.id || null }),
        });
        throw new ForbiddenError('Restore execution is disabled in production environments. Use validate or dry-run instead.');
    }

    const result = await service.executeRestore(filename, { requestedBy: user?.id || null });

    scheduleAuditEvent(c, {
        domain: 'backups',
        action: 'backup.restore.execute',
        result: 'success',
        severity: 'critical',
        targetType: 'backup',
        targetId: filename,
        target_label: filename,
        summary: `Prepared restore execution summary for ${filename}`,
        metadata: buildRestoreAuditMetadata(result, { requestedBy: user?.id || null }),
    });

    return c.json({ success: true, data: result });
});

/**
 * DELETE /[filename] - 删除备份
 */
app.delete('/:filename', requirePermission('admin:full'), async (c) => {
    const { env } = c;
    const filename = c.req.param('filename');
    await env.R2_BACKUP_BUCKET.delete(filename);
    scheduleAuditEvent(c, {
        domain: 'backups',
        action: 'backup.delete',
        result: 'success',
        severity: 'critical',
        targetType: 'backup',
        targetId: filename,
        target_label: filename,
        summary: `Deleted backup ${filename}`,
    });
    return c.json({ success: true, message: MSG.COMMON.DELETE_SUCCESS });
});

export default app;
