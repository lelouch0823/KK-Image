import { Hono } from 'hono';
import { MSG, generateId, getFileUrl, timestampToIso } from '../../../../_shared/utils.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/upload',
    domain: 'sales-files',
    action: 'sales.file.upload',
    severity: 'normal',
    targetType: 'file',
    runtimeAssertionLevel: 'runtime',
  },
]);

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
    const order = await env.DB.prepare(
      'SELECT order_no FROM orders WHERE id = ? AND salesperson_id = ? AND archived_at IS NULL'
    )
      .bind(orderId, salesperson.id)
      .first();
    if (order?.order_no) {
      const { ensureOrderFolder } = await import('../../../../api/utils/folder-utils.js');
      folderId = await ensureOrderFolder(env, order.order_no);
    } else {
      return c.json({ success: false, error: MSG.AUTH.FORBIDDEN }, 403);
    }
  }

  const { storeFile } = await import('../../../../api/utils/file-utils.js');
  const result = await storeFile(env, file, {
    contentHash,
    originalHash, // 传递给存储逻辑
    folderId,
    createdBy: salesperson.id,
  });

  if (orderId && result?.id) {
    const timestamp = Date.now();
    const maxOrderRow = await env.DB.prepare(
      'SELECT MAX(sort_order) as max_order FROM order_files WHERE order_id = ?'
    )
      .bind(orderId)
      .first();
    const nextOrder = (maxOrderRow?.max_order ?? -1) + 1;

    await env.DB.batch([
      env.DB.prepare(
        `
              INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
              VALUES (?, ?, ?, 'product', ?, ?)
            `
      ).bind(generateId(), orderId, result.id, nextOrder, timestamp),
      env.DB.prepare('UPDATE orders SET updated_at = ? WHERE id = ?').bind(timestamp, orderId),
    ]);
  }
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

  await publishSingleDomainEventAndPoll(
    c,
    {
      event_type: 'file_uploaded',
      aggregate_type: 'file',
      aggregate_id: result.id,
      payload: {
        file: {
          id: result.id,
          filename: result.name || file?.name || '',
          size: result.size ?? file?.size ?? 0,
          type: result.type || file?.type || 'application/octet-stream',
          uploadTime: timestampToIso(Date.now()),
          url: getFileUrl(result.storageKey || result.storage_key || ''),
          uploader: salesperson.name || salesperson.id,
        },
        user: salesperson,
      },
    },
    `file-uploaded:${result.id}`
  );

  return c.json({
    success: true,
    data: result,
    message: result.instantUpload ? MSG.FILE.INSTANT_UPLOAD : MSG.FILE.UPLOAD_SUCCESS,
  });
});

export default app;
