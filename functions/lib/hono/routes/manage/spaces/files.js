/**
 * 空间文件操作路由
 * POST /:id/files - 添加文件
 * DELETE /:id/files - 移除文件
 */

import { Hono } from 'hono';
import { requirePermission } from '../../../middleware/auth.js';
import { MSG } from '../../../_shared/utils.js';
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';
import { getAllSalespersonAccessTokens } from '../../../_shared/route-helpers.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';
import { invalidateCache } from '../../../middleware/cache.js';
import { getManageSpaceCacheUrls, getSalesSpaceCacheUrls } from '../../_shared/cache-urls.js';

const files = new Hono();

const invalidateSpaceCaches = (c, options = {}) => {
  c.executionCtx.waitUntil((async () => {
    const salesTokens = await getAllSalespersonAccessTokens(c.env.DB);
    const urls = [
      ...getManageSpaceCacheUrls(c, options),
      ...getSalesSpaceCacheUrls(c, { salesTokens, spaceId: options.spaceId }),
    ];
    await invalidateCache([...new Set(urls)]);
  })());
};

/**
 * POST /files - 添加文件到空间
 */
files.post('/', requirePermission('spaces:manage'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const { fileIds } = await c.req.json();
  const repo = new SpaceRepository(env.DB);

  if (!fileIds?.length) throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);

  const space = await repo.findById(spaceId);
  if (!space) throw new NotFoundError(MSG.SPACE.NOT_FOUND);

  await repo.addFiles(spaceId, fileIds);
  invalidateSpaceCaches(c, { spaceId, parentId: space.parent_id || null, productIds: [space.product_id] });

  return c.json({
    success: true,
    message: MSG.SPACE.ADD_FILES_SUCCESS.replace('{count}', fileIds.length),
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

  if (!fileIds?.length) throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);

  await repo.removeFiles(spaceId, fileIds);
  const space = await repo.findById(spaceId);
  invalidateSpaceCaches(c, {
    spaceId,
    parentId: space?.parent_id || null,
    productIds: [space?.product_id || null],
  });

  return c.json({
    success: true,
    message: MSG.SPACE.REMOVE_FILES_SUCCESS.replace('{count}', fileIds.length),
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

  if (!fileIds?.length) throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);

  await repo.reorderFiles(spaceId, fileIds);
  const space = await repo.findById(spaceId);
  invalidateSpaceCaches(c, {
    spaceId,
    parentId: space?.parent_id || null,
    productIds: [space?.product_id || null],
  });

  return c.json({
    success: true,
    message: MSG.COMMON.UPDATE_SUCCESS,
  });
});

export default files;
