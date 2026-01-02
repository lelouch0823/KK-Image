/**
 * 销售端文件上传 API
 * POST /api/sales/:token/upload - 上传图片
 * Query params:
 *   - orderId: 订单ID (可选，如果提供则直接归档到订单文件夹)
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateSalesperson } from '../../utils/salesperson-auth.js';

/**
 * POST - 上传文件
 */
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const accessToken = params.token;

  try {
    // 验证销售身份
    const salesperson = await authenticateSalesperson(request, env, accessToken);

    // 解析查询参数
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    const contentHash = url.searchParams.get('contentHash'); // 压缩后 hash
    const originalHash = url.searchParams.get('originalHash'); // 原始文件 hash

    // 解析 FormData
    const formData = await request.formData();
    const file = formData.get('file');

    // 确定目标文件夹
    let folderId = 'root';

    // 如果提供了 orderId，直接归档到订单文件夹
    if (orderId) {
      try {
        // 获取订单号
        const order = await env.DB.prepare('SELECT order_no FROM orders WHERE id = ?')
          .bind(orderId)
          .first();

        if (order && order.order_no) {
          const { ensureOrderFolder } = await import('../../utils/folder-utils.js');
          folderId = await ensureOrderFolder(env, order.order_no);
        }
      } catch (e) {
        console.error('Archive folder creation error:', e);
        // 失败时回退到 root
      }
    }

    // 使用通用工具存储文件 (支持 CAS + 原始 Hash 去重)
    const { storeFile } = await import('../../utils/file-utils.js');
    const result = await storeFile(env, file, {
      contentHash,
      originalHash, // 传递原始文件 hash
      folderId,
      createdBy: salesperson.id,
    });

    // 统一返回格式
    return success(
      result,
      result.instantUpload ? MSG.FILE.INSTANT_UPLOAD : MSG.FILE.UPLOAD_SUCCESS
    );
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    if (err.message === MSG.SALESPERSON.DISABLED) {
      return error(err.message, 403);
    }
    console.error('Sales upload error:', err);
    // 如果是已知业务错误，返回 400
    const isClientError = Object.values(MSG.FILE).includes(err.message);
    return error(
      isClientError ? err.message : `上传失败: ${err.message}`,
      isClientError ? 400 : 500
    );
  }
}
