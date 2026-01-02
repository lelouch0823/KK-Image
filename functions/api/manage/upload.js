/**
 * 管理端文件上传 API
 * POST /api/manage/upload - 上传图片
 * Query params:
 *   - orderId: 订单ID (可选，如果提供则直接归档到订单文件夹)
 *   - contentHash: SHA-256 哈希 (可选，用于秒传检测)
 */

import { success, error } from '../utils/response.js';
import { generateId, now } from '../utils/id.js';
import { MSG } from '../utils/messages.js';
import { ensureFolder } from '../utils/folder-utils.js';
import { getBlobByHash, createBlob, incrementRefCount } from '../utils/blob-utils.js';

/**
 * POST - 上传文件
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const { authenticateAdmin } = await import('../utils/auth.js');
    const admin = await authenticateAdmin(request, env);

    // 解析查询参数
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    const contentHash = url.searchParams.get('contentHash'); // 压缩后 hash
    const originalHash = url.searchParams.get('originalHash'); // 原始文件 hash

    // 解析 FormData
    const formData = await request.formData();
    const file = formData.get('file');

    // 获取管理员信息 (可选，用于记录 created_by)
    // 这里简化处理，未强制校验 Auth (通常由中间件处理，或此处添加 verifyJWT)
    // const admin = ...

    // 确定目标文件夹
    let folderId = 'root';

    if (orderId) {
      try {
        const order = await env.DB.prepare('SELECT order_no FROM orders WHERE id = ?')
          .bind(orderId)
          .first();

        if (order && order.order_no) {
          const { ensureOrderFolder } = await import('../utils/folder-utils.js');
          folderId = await ensureOrderFolder(env, order.order_no);
        }
      } catch (e) {
        console.error('Archive folder creation error:', e);
      }
    }

    // 使用通用工具存储文件 (支持 CAS + 原始 Hash 去重)
    const { storeFile } = await import('../utils/file-utils.js');
    const result = await storeFile(env, file, {
      contentHash,
      originalHash, // 传递原始文件 hash
      folderId,
      createdBy: admin.id, // 标记为管理员上传
    });

    return success(
      result,
      result.instantUpload ? MSG.FILE.INSTANT_UPLOAD : MSG.FILE.UPLOAD_SUCCESS
    );
  } catch (err) {
    console.error('Admin upload error:', err);
    // 如果是已知业务错误，返回 400
    const isClientError = Object.values(MSG.FILE).includes(err.message);
    return error(
      isClientError ? err.message : `上传失败: ${err.message}`,
      isClientError ? 400 : 500
    );
  }
}
