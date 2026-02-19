/**
 * 空间文件操作路由
 * POST /:id/files - 添加文件
 * DELETE /:id/files - 移除文件
 */

import { Hono } from 'hono';
import { requirePermission } from '../../../middleware/auth.js';
import { MSG } from '../../../_shared/utils.js';
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';

const files = new Hono();

/**
 * POST /files - 添加文件到空间
 */
files.post('/', requirePermission('files:write'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const { fileIds } = await c.req.json();
  const repo = new SpaceRepository(env.DB);

  try {
    if (!fileIds?.length) {
      return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
    }

    const space = await repo.findById(spaceId);
    if (!space) {
      return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
    }

    await repo.addFiles(spaceId, fileIds);

    return c.json({
      success: true,
      message: MSG.SPACE.ADD_FILES_SUCCESS.replace('{count}', fileIds.length),
    });
  } catch (err) {
    console.error(`${MSG.COMMON.OP_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * DELETE /files - 从空间移除文件
 */
files.delete('/', requirePermission('files:write'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const { fileIds } = await c.req.json();
  const repo = new SpaceRepository(env.DB);

  try {
    if (!fileIds?.length) {
      return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
    }

    await repo.removeFiles(spaceId, fileIds);

    return c.json({
      success: true,
      message: MSG.SPACE.REMOVE_FILES_SUCCESS.replace('{count}', fileIds.length),
    });
  } catch (err) {
    console.error(`${MSG.COMMON.OP_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * PUT /files/order - 更新文件排序
 */
files.put('/order', requirePermission('files:write'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const { fileIds } = await c.req.json();
  const repo = new SpaceRepository(env.DB);

  try {
    if (!fileIds?.length) {
      return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
    }

    await repo.reorderFiles(spaceId, fileIds);

    return c.json({
      success: true,
      message: MSG.COMMON.UPDATE_SUCCESS,
    });
  } catch (err) {
    console.error(`${MSG.COMMON.OP_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
  }
});

export default files;
