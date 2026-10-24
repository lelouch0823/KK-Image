/**
 * 空间文件操作路由
 * POST /:id/files - 添加文件
 * DELETE /:id/files - 移除文件
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requirePermission } from '../../../middleware/auth.js';
import { MSG } from '../../../../../_shared/utils.js';
import { BadRequestError } from '../../../errors.js';
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';
import { FileRepository } from '../../../../../repositories/FileRepository.js';
import { invalidateSpaceCaches } from './cache-helpers.js';
import { buildSpaceInvalidatePayload, requireSpace } from './route-helpers.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { SpaceAddFilesSchema, SpaceFileIdsSchema } from '../../../schemas/space.js';

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
 *
 * F1：支持 folderIds（服务端递归展开文件夹及子文件夹内的文件），
 * 与 fileIds 可同时提供；重复添加幂等（INSERT OR IGNORE）。
 */
files.post(
  '/',
  requirePermission('spaces:manage'),
  zValidator('json', SpaceAddFilesSchema),
  async (c) => {
    const { env } = c;
    const spaceId = c.req.param('id');
    const { fileIds = [], folderIds = [] } = c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    const space = await requireSpace(repo, spaceId);

    let resolvedFileIds = [...fileIds];
    if (folderIds.length > 0) {
      const fileRepo = new FileRepository(env.DB);
      const folderFileIds = await fileRepo.findIdsByFoldersRecursive(folderIds);
      resolvedFileIds = [...new Set([...resolvedFileIds, ...folderFileIds])];
    }
    if (resolvedFileIds.length === 0) {
      throw new BadRequestError('所选文件或文件夹内没有可添加的文件');
    }

    await repo.addFiles(spaceId, resolvedFileIds);
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
      summary: `Added ${resolvedFileIds.length} files to space ${space?.name || spaceId}`,
      metadata: {
        count: resolvedFileIds.length,
        requestedFileCount: fileIds.length,
        folderCount: folderIds.length,
      },
    });

    return c.json({
      success: true,
      message: MSG.SPACE.ADD_FILES_SUCCESS.replace('{count}', resolvedFileIds.length),
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
