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
    return c.json({ success: true, data: { exists: false } }, 404);
  }
});

export default app;
