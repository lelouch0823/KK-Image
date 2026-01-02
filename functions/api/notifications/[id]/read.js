/**
 * 标记通知已读 API
 * POST /api/notifications/[id]/read - 标记单个已读
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const { id } = params;

  if (!id) {
    return error(MSG.COMMON.INVALID_PARAMS, 400);
  }

  try {
    if (id === 'all') {
      // 标记所有为已读
      await env.DB.prepare(
        `
                UPDATE notifications SET is_read = 1 WHERE is_read = 0
            `
      ).run();
    } else {
      // 标记单个
      await env.DB.prepare(
        `
                UPDATE notifications SET is_read = 1 WHERE id = ?
            `
      )
        .bind(id)
        .run();
    }

    return success(null, MSG.COMMON.UPDATE_SUCCESS);
  } catch (err) {
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
