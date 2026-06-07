/**
 * 空间文件操作路由
 * POST /:id/files - 添加文件
 * DELETE /:id/files - 移除文件
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requirePermission } from '../../../middleware/auth.js';
import { MSG } from '../../../../../_shared/utils.js';
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';
import { invalidateSpaceCaches } from './cache-helpers.js';
import { buildSpaceInvalidatePayload, requireSpace } from './route-helpers.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { SpaceFileIdsSchema } from '../../../schemas/space.js';

const files = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/',
    domain: 'spaces',
    action: 'space.file.add',
    severity: 'high',
    targetType: 'space',
  },
  {
    method: 'DELETE',
    path: '/',
    domain: 'spaces',
    action: 'space.file.remove',
    severity: 'high',
    targetType: 'space',
  },
  {
    method: 'PUT',
    path: '/order',
    domain: 'spaces',
    action: 'space.file.reorder',
    severity: 'high',
    targetType: 'space',
  },
]);

/**
 * POST /files - 添加文件到空间
 */
files.post(
  '/',
  requirePermission('spaces:manage'),
  zValidator('json', SpaceFileIdsSchema),
  async (c) => {
    const { env } = c;
    const spaceId = c.req.param('id');
    const { fileIds } = c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    const space = await requireSpace(repo, spaceId);

    await repo.addFiles(spaceId, fileIds);
    await invalidateSpaceCaches(c, {
      ...buildSpaceInvalidatePayload({ spaceId, space }),
      eventType: 'space_file_added',
    });
    scheduleAuditEvent(c, {
      domain: 'spaces',
      action: 'space.file.add',
      result: 'success',
      severity: 'high',
      targetType: 'space',
      targetId: spaceId,
      target_label: space?.name || spaceId,
      summary: `Added ${fileIds.length} files to space ${space?.name || spaceId}`,
      metadata: { count: fileIds.length },
    });

    return c.json({
      success: true,
      message: MSG.SPACE.ADD_FILES_SUCCESS.replace('{count}', fileIds.length),
    });
  }
);

/**
 * DELETE /files - 从空间移除文件
 */
files.delete(
  '/',
  requirePermission('spaces:manage'),
  zValidator('json', SpaceFileIdsSchema),
  async (c) => {
    const { env } = c;
    const spaceId = c.req.param('id');
    const { fileIds } = c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    await repo.removeFiles(spaceId, fileIds);
    const space = await repo.findById(spaceId);
    await invalidateSpaceCaches(c, {
      ...buildSpaceInvalidatePayload({ spaceId, space }),
      eventType: 'space_file_removed',
    });
    scheduleAuditEvent(c, {
      domain: 'spaces',
      action: 'space.file.remove',
      result: 'success',
      severity: 'high',
      targetType: 'space',
      targetId: spaceId,
      target_label: space?.name || spaceId,
      summary: `Removed ${fileIds.length} files from space ${space?.name || spaceId}`,
      metadata: { count: fileIds.length },
    });

    return c.json({
      success: true,
      message: MSG.SPACE.REMOVE_FILES_SUCCESS.replace('{count}', fileIds.length),
    });
  }
);

/**
 * PUT /files/order - 更新文件排序
 */
files.put(
  '/order',
  requirePermission('spaces:manage'),
  zValidator('json', SpaceFileIdsSchema),
  async (c) => {
    const { env } = c;
    const spaceId = c.req.param('id');
    const { fileIds } = c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    await repo.reorderFiles(spaceId, fileIds);
    const space = await repo.findById(spaceId);
    await invalidateSpaceCaches(c, {
      ...buildSpaceInvalidatePayload({ spaceId, space }),
      eventType: 'space_file_reordered',
    });
    scheduleAuditEvent(c, {
      domain: 'spaces',
      action: 'space.file.reorder',
      result: 'success',
      severity: 'high',
      targetType: 'space',
      targetId: spaceId,
      target_label: space?.name || spaceId,
      summary: `Reordered files in space ${space?.name || spaceId}`,
      metadata: { count: fileIds.length },
    });

    return c.json({
      success: true,
      message: MSG.COMMON.UPDATE_SUCCESS,
    });
  }
);

export default files;
