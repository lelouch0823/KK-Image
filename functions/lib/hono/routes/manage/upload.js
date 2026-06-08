import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { MSG, storeFile, getFileUrl, timestampToIso } from '../../../../_shared/utils.js';
import { BadRequestError, NotFoundError } from '../../errors.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishDomainEventsAndPoll } from '../../_shared/domain-outbox.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/',
    domain: 'uploads',
    action: 'upload.create',
    severity: 'normal',
    targetType: 'file',
  },
]);

/**
 * POST / - 管理端上传接口
 */
app.post('/', requirePermission('files:write'), async (c) => {
  const { env } = c;
  const user = c.get('user');

  const url = new URL(c.req.url);
  const orderId = url.searchParams.get('orderId');
  const contentHash = url.searchParams.get('contentHash');
  const originalHash = url.searchParams.get('originalHash');

  const formData = await c.req.parseBody();
  const file = formData['file'];

  if (!file || !(file instanceof File)) {
    throw new BadRequestError(MSG.COMMON.UPLOAD_NO_FILE);
  }

  let folderId = 'root';
  const context = url.searchParams.get('context');
  const normalizedContext = String(context || '').toLowerCase();
  const spaceId = url.searchParams.get('spaceId');
  let targetSpace = null;

  if (spaceId) {
    let hasSpaceManagePermission = false;
    const permissionResponse = await requirePermission('spaces:manage')(c, async () => {
      hasSpaceManagePermission = true;
    });
    if (!hasSpaceManagePermission) {
      return permissionResponse;
    }
  }

  if (normalizedContext === 'product' || normalizedContext === 'variant') {
    const { ensureProductFolder } = await import('../../../../api/utils/folder-utils.js');
    folderId = await ensureProductFolder(env);
  } else if (orderId) {
    const order = await env.DB.prepare(
      'SELECT order_no FROM orders WHERE id = ? AND archived_at IS NULL'
    )
      .bind(orderId)
      .first();
    if (order?.order_no) {
      const { ensureOrderFolder } = await import('../../../../api/utils/folder-utils.js');
      folderId = await ensureOrderFolder(env, order.order_no);
    }
  } else if (spaceId) {
    targetSpace = await env.DB.prepare(
      'SELECT name, parent_id, product_id FROM spaces WHERE id = ?'
    )
      .bind(spaceId)
      .first();
    if (!targetSpace) throw new NotFoundError(MSG.SPACE.NOT_FOUND);

    const { ensureSpaceFolder } = await import('../../../../api/utils/folder-utils.js');
    folderId = await ensureSpaceFolder(env, targetSpace.name);
  }

  const result = await storeFile(env, file, {
    contentHash,
    originalHash,
    folderId,
    createdBy: user.id || 'admin',
  });
  const uploadedFileId = result?.file?.id || result?.id || null;

  // 如果传了 spaceId，则将文件关联到该空间
  if (spaceId && uploadedFileId) {
    // 获取当前空间的最大 sort_order
    const maxOrderRow = await env.DB.prepare(
      'SELECT MAX(sort_order) as max_order FROM space_files WHERE space_id = ?'
    )
      .bind(spaceId)
      .first();
    const nextOrder = (maxOrderRow?.max_order ?? -1) + 1;

    await env.DB.prepare(
      'INSERT INTO space_files (space_id, file_id, sort_order, added_at) VALUES (?, ?, ?, ?)'
    )
      .bind(spaceId, uploadedFileId, nextOrder, Date.now())
      .run();

    // 更新空间的 updated_at
    await env.DB.prepare('UPDATE spaces SET updated_at = ? WHERE id = ?')
      .bind(Date.now(), spaceId)
      .run();
  }
  scheduleAuditEvent(c, {
    domain: 'uploads',
    action: 'upload.create',
    result: 'success',
    severity: 'normal',
    targetType: 'file',
    targetId: uploadedFileId,
    target_label: file.name,
    summary: `Uploaded ${file.name}`,
    metadata: { context: normalizedContext || null, orderId, spaceId },
  });

  if (uploadedFileId) {
    const storageKey = result?.storageKey || result?.storage_key || '';
    const outboxEvents = [
      {
        event_type: 'file_uploaded',
        aggregate_type: 'file',
        aggregate_id: uploadedFileId,
        payload: {
          file: {
            id: uploadedFileId,
            filename: result?.name || file.name,
            size: result?.size ?? file.size ?? 0,
            type: result?.type || file.type || 'application/octet-stream',
            uploadTime: timestampToIso(Date.now()),
            url: getFileUrl(storageKey),
            uploader: user.name || user.username || user.id,
          },
          user,
        },
      },
    ];

    if (spaceId) {
      outboxEvents.push({
        event_type: 'space_file_added',
        aggregate_type: 'space',
        aggregate_id: spaceId,
        payload: {
          space_id: spaceId,
          parent_id: targetSpace?.parent_id || null,
          product_ids: [...new Set([targetSpace?.product_id].filter(Boolean))],
          file_ids: [uploadedFileId],
        },
      });
    }

    await publishDomainEventsAndPoll(c, outboxEvents, `manage-upload:${uploadedFileId}`);
  }

  return c.json({
    success: true,
    message: result.instantUpload ? MSG.FILE.INSTANT_UPLOAD : MSG.FILE.UPLOAD_SUCCESS,
    data: result,
  });
});

export default app;
