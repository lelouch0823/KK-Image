/**
 * 数据库备份管理 API
 * GET /api/manage/backups - 列出所有备份
 * POST /api/manage/backups - 创建新备份 (Streaming SOTA)
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { verifyJWT, ADMIN_AUTH_COOKIE } from '../../utils/auth.js';
import { parse as parseCookie } from 'cookie';

/**
 * 鉴权辅助函数
 */
async function checkAdmin(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookie(cookieHeader);
  const jwt = cookies[ADMIN_AUTH_COOKIE];

  if (!jwt) throw new Error(MSG.AUTH.REQUIRED);
  await verifyJWT(jwt, env);
}

/**
 * GET - 列出备份
 */
export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    await checkAdmin(request, env);

    // 列出 R2_BACKUP_BUCKET 中的文件
    const list = await env.R2_BACKUP_BUCKET.list();

    const backups = list.objects
      .map((obj) => ({
        name: obj.key,
        size: obj.size,
        uploadedAt: obj.uploaded,
        key: obj.key,
      }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return success(backups);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED) return error(err.message, 401);
    console.error('List backups failed:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

import { performStreamingBackup } from '../../utils/backup-utils.js';

/**
 * POST - 创建备份
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    await checkAdmin(request, env);

    const { filename, key } = await performStreamingBackup(env);

    return success(
      {
        filename,
        key,
        size: 0,
        note: 'Backup created successfully',
      },
      MSG.COMMON.OP_SUCCESS
    );
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED) return error(err.message, 401);
    console.error('Create backup failed:', err);
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
