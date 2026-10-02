import { Hono } from 'hono';
import { getBlobByHash } from '../../../../api/utils/blob-utils.js';
import { BadRequestError } from '../../errors.js';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();
app.use('*', requirePermission('files:write'));

/**
 * GET /api/manage/utils/check-hash - 检查文件哈希
 */
app.get('/check-hash', async (c) => {
  const hash = c.req.query('hash');
  if (!hash) throw new BadRequestError('Missing hash parameter');

  const blob = await getBlobByHash(c.env, hash);
  if (blob) {
    return c.json({
      success: true,
      data: {
        exists: true,
        contentHash: blob.content_hash,
        size: blob.size,
        mimeType: blob.mime_type,
      },
    });
  } else {
    // "未命中" 是正常查询结果而非错误：返回 200 与 exists:false，
    // 消除 success:true 与 HTTP 404 的自相矛盾
    return c.json({ success: true, data: { exists: false } });
  }
});

export default app;
