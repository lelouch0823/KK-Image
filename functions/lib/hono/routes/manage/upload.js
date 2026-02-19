import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { MSG, storeFile } from '../../_shared/utils.js';

const app = new Hono();

/**
 * POST / - 管理端上传接口
 */
app.post('/', requirePermission('files:write'), async (c) => {
    const { env } = c;
    const user = c.get('user');

    try {
        const url = new URL(c.req.url);
        const orderId = url.searchParams.get('orderId');
        const contentHash = url.searchParams.get('contentHash');
        const originalHash = url.searchParams.get('originalHash');

        const formData = await c.req.parseBody();
        const file = formData['file'];

        if (!file || !(file instanceof File)) {
            return c.json({ success: false, error: MSG.COMMON.UPLOAD_NO_FILE }, 400);
        }

        let folderId = 'root';
        const context = url.searchParams.get('context');

        if (context === 'product') {
            const { ensureProductFolder } = await import('../../../../api/utils/folder-utils.js');
            folderId = await ensureProductFolder(env);
        } else if (orderId) {
            const order = await env.DB.prepare('SELECT order_no FROM orders WHERE id = ?').bind(orderId).first();
            if (order?.order_no) {
                const { ensureOrderFolder } = await import('../../../../api/utils/folder-utils.js');
                folderId = await ensureOrderFolder(env, order.order_no);
            }
        }

        const result = await storeFile(env, file, {
            contentHash,
            originalHash,
            folderId,
            createdBy: user.id || 'admin',
        });

        return c.json({
            success: true,
            message: result.instantUpload ? MSG.FILE.INSTANT_UPLOAD : MSG.FILE.UPLOAD_SUCCESS,
            data: result,
        });
    } catch (err) {
        console.error('Upload failed:', err);
        return c.json({ success: false, error: `${MSG.COMMON.UPLOAD_FAILED}: ${err.message}` }, 500);
    }
});

export default app;
