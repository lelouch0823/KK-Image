import { Hono } from 'hono';
import { MSG } from '../../_shared/utils.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';

const app = new Hono();

/**
 * POST /upload - 上传文件
 */
app.post('/upload', async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;
    const formData = await c.req.formData();
    const file = formData.get('file');
    const orderId = c.req.query('orderId');
    const contentHash = c.req.query('contentHash');
    const originalHash = c.req.query('originalHash'); // 原始文件 hash (用于跨设备秒传)

    let folderId = 'root';
    if (orderId) {
        const order = await env.DB.prepare('SELECT order_no FROM orders WHERE id = ?').bind(orderId).first();
        if (order?.order_no) {
            const { ensureOrderFolder } = await import('../../../../api/utils/folder-utils.js');
            folderId = await ensureOrderFolder(env, order.order_no);
        }
    }

    const { storeFile } = await import('../../../../api/utils/file-utils.js');
    const result = await storeFile(env, file, {
        contentHash,
        originalHash, // 传递给存储逻辑
        folderId,
        createdBy: salesperson.id,
    });
    scheduleAuditEvent(c, {
        domain: 'sales-files',
        action: 'sales.file.upload',
        result: 'success',
        severity: 'normal',
        targetType: 'file',
        targetId: result?.id || null,
        target_label: file?.name || result?.name || null,
        summary: `${salesperson.name} uploaded ${file?.name || 'a file'}`,
        metadata: { orderId: orderId || null, instantUpload: Boolean(result?.instantUpload) },
    });

    return c.json({
        success: true,
        data: result,
        message: result.instantUpload ? MSG.FILE.INSTANT_UPLOAD : MSG.FILE.UPLOAD_SUCCESS
    });
});

export default app;
