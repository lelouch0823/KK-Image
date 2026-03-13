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
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';

const files = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/', domain: 'spaces', action: 'space.file.add', severity: 'high', targetType: 'space' },
  { method: 'DELETE', path: '/', domain: 'spaces', action: 'space.file.remove', severity: 'high', targetType: 'space' },
  { method: 'PUT', path: '/order', domain: 'spaces', action: 'space.file.reorder', severity: 'high', targetType: 'space' },
]);

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
  scheduleAuditEvent(c, {
    domain: 'spaces',
    action: 'space.file.add',
    result: 'success',
    severity: 'high',
    targetType: 'space',
    targetId: spaceId,
    target_label: space?.name || spaceId,
    summary: `Added ${normalizedFileIds.length} files to space ${space?.name || spaceId}`,
    metadata: { count: normalizedFileIds.length },
  });

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
  scheduleAuditEvent(c, {
    domain: 'spaces',
    action: 'space.file.remove',
    result: 'success',
    severity: 'high',
    targetType: 'space',
    targetId: spaceId,
    target_label: space?.name || spaceId,
    summary: `Removed ${normalizedFileIds.length} files from space ${space?.name || spaceId}`,
    metadata: { count: normalizedFileIds.length },
  });

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
  scheduleAuditEvent(c, {
    domain: 'spaces',
    action: 'space.file.reorder',
    result: 'success',
    severity: 'high',
    targetType: 'space',
    targetId: spaceId,
    target_label: space?.name || spaceId,
    summary: `Reordered files in space ${space?.name || spaceId}`,
    metadata: { count: normalizedFileIds.length },
  });

  return c.json({
    success: true,
    message: MSG.COMMON.UPDATE_SUCCESS,
  });
});

export default files;
