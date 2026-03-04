/**
 * 子空间操作路由
 * GET /:id/subspaces - 获取子空间列表
 * POST /:id/subspaces - 创建子空间
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../../middleware/auth.js';
import { withCache, invalidateCache } from '../../../middleware/cache.js';
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';
import { getAllSalespersonAccessTokens } from '../../../_shared/route-helpers.js';
import {
  generateId,
  generateShareToken,
  MSG,
  getShareUrl,
} from '../../../_shared/utils.js';
import { transformSpaceListItem } from './transformers.js';
import { NotFoundError } from '../../../errors.js';
import { getManageSpaceCacheUrls, getSalesSpaceCacheUrls } from '../../_shared/cache-urls.js';

const subspaces = new Hono();

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

// Schema
const CreateSubspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  isPublic: z.boolean().optional().default(false),
  password: z.string().min(4).max(50).optional().nullable(),
  expiresAt: z.number().optional().nullable(),
  template: z.string().optional().default('gallery'),
  templateData: z.record(z.any()).optional().default({}),
});

/**
 * GET / - 获取子空间列表
 */
subspaces.get('/', withCache(30), async (c) => {
  const { env } = c;
  const parentId = c.req.param('id');
  const repo = new SpaceRepository(env.DB);

  const results = await repo.findSubspaces(parentId);
  return c.json({
    success: true,
    data: results.map(transformSpaceListItem),
  });
});

/**
 * POST / - 创建子空间
 */
subspaces.post(
  '/',
  requirePermission('spaces:manage'),
  zValidator('json', CreateSubspaceSchema),
  async (c) => {
    const { env } = c;
    const parentId = c.req.param('id');
    const { name, description, isPublic, password, expiresAt, template, templateData } =
      c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    // 验证父空间存在
    const parent = await repo.findById(parentId);
    if (!parent) throw new NotFoundError(MSG.SPACE.NOT_FOUND);

    const spaceId = generateId();
    const shareToken = generateShareToken();
    const nowMs = Date.now();

    const newSubspace = {
      id: spaceId,
      parentId,
      name: name.trim(),
      description: description.trim(),
      isPublic,
      password: password || null,
      shareToken,
      expiresAt: expiresAt || null,
      template,
      templateData: JSON.stringify(templateData),
      createdAt: nowMs,
      updatedAt: nowMs,
    };

    await repo.createSubspace(newSubspace);
    invalidateSpaceCaches(c, { spaceId: parentId, parentId, productIds: [parent.product_id] });

    return c.json(
      {
        success: true,
        data: {
          id: spaceId,
          parentId,
          name: name.trim(),
          description: description.trim(),
          isPublic,
          shareToken,
          shareUrl: getShareUrl(shareToken, 'space'),
          template,
          createdAt: nowMs,
        },
      },
      201
    );
  }
);

export default subspaces;
