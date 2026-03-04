/**
 * 空间文件操作路由
 * POST /:id/files - 添加文件
 * DELETE /:id/files - 移除文件
 */

import { Hono } from 'hono';
import { requirePermission } from '../../../middleware/auth.js';
import { MSG } from '../../../_shared/utils.js';
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';
import { BadRequestError } from '../../../errors.js';
import { invalidateSpaceCaches } from './cache-helpers.js';
import { buildSpaceInvalidatePayload, requireSpace } from './route-helpers.js';

const files = new Hono();

function assertFileIds(fileIds) {
  if (!fileIds?.length) throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);
  return fileIds;
}

/**
 * POST /files - 添加文件到空间
 */
files.post('/', requirePermission('spaces:manage'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const { fileIds } = await c.req.json();
  const repo = new SpaceRepository(env.DB);

  const normalizedFileIds = assertFileIds(fileIds);

  const space = await requireSpace(repo, spaceId);

  await repo.addFiles(spaceId, normalizedFileIds);
  invalidateSpaceCaches(c, buildSpaceInvalidatePayload({ spaceId, space }));

  return c.json({
    success: true,
    message: MSG.SPACE.ADD_FILES_SUCCESS.replace('{count}', normalizedFileIds.length),
  });
});

/**
 * DELETE /files - 从空间移除文件
 */
files.delete('/', requirePermission('spaces:manage'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const { fileIds } = await c.req.json();
  const repo = new SpaceRepository(env.DB);

  const normalizedFileIds = assertFileIds(fileIds);

  await repo.removeFiles(spaceId, normalizedFileIds);
  const space = await repo.findById(spaceId);
  invalidateSpaceCaches(c, buildSpaceInvalidatePayload({ spaceId, space }));

  return c.json({
    success: true,
    message: MSG.SPACE.REMOVE_FILES_SUCCESS.replace('{count}', normalizedFileIds.length),
  });
});

/**
 * PUT /files/order - 更新文件排序
 */
files.put('/order', requirePermission('spaces:manage'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const { fileIds } = await c.req.json();
  const repo = new SpaceRepository(env.DB);

  const normalizedFileIds = assertFileIds(fileIds);

  await repo.reorderFiles(spaceId, normalizedFileIds);
  const space = await repo.findById(spaceId);
  invalidateSpaceCaches(c, buildSpaceInvalidatePayload({ spaceId, space }));

  return c.json({
    success: true,
    message: MSG.COMMON.UPDATE_SUCCESS,
  });
});

export default files;
