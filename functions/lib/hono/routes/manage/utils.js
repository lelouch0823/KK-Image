import { Hono } from 'hono';
import { getBlobByHash } from '../../../../api/utils/blob-utils.js';
import { MSG } from '../../_shared/utils.js';

const app = new Hono();

/**
 * GET /api/manage/utils/check-hash - 检查文件哈希
 */
app.get('/check-hash', async (c) => {
    const hash = c.req.query('hash');
    if (!hash) return c.json({ success: false, error: 'Missing hash parameter' }, 400);

    try {
        const blob = await getBlobByHash(c.env, hash);
        if (blob) {
            return c.json({
                success: true,
                data: {
                    exists: true,
                    contentHash: blob.content_hash,
                    size: blob.size,
                    mimeType: blob.mime_type,
                }
            });
        } else {
            return c.json({ success: true, data: { exists: false } }, 404);
        }
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default app;
