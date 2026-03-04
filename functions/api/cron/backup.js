/**
 * 定时任务：自动化备份
 * 触发方式：外部 Cron 服务调用 GET/POST /api/cron/backup
 * 鉴权：Header Authorization: Bearer <CRON_SECRET>
 */

import { success, error } from '../utils/response.js';
import { performStreamingBackup, cleanupOldBackups } from '../utils/backup-utils.js';
import { isCronAuthorized } from '../utils/cron-auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  // 1. 鉴权
  if (!isCronAuthorized(request, env)) {
    return error('Unauthorized', 401);
  }

  try {
    // 2. 执行备份
    const { filename } = await performStreamingBackup(env);

    // 3. 执行清理 (保留最近 7 个)
    const deletedCount = await cleanupOldBackups(env, 7);

    return success(
      {
        backup: filename,
        cleanup: {
          deleted: deletedCount,
          keep: 7,
        },
      },
      'Automatic backup completed'
    );
  } catch (err) {
    console.error('Cron Backup failed:', err);
    return error(`Cron Backup Failed: ${err.message}`, 500);
  }
}
