/**
 * 子空间操作路由
 * GET /:id/subspaces - 获取子空间列表
 * POST /:id/subspaces - 创建子空间
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../../middleware/auth.js';
import { SpaceRepository } from '../../../repositories/SpaceRepository.js';
import {
  generateId,
  generateShareToken,
  MSG,
  getShareUrl,
} from '../../../_shared/utils.js';
import { transformSpaceListItem } from './transformers.js';

const subspaces = new Hono();

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
subspaces.get('/', async (c) => {
  const { env } = c;
  const parentId = c.req.param('id');
  const repo = new SpaceRepository(env.DB);

  try {
    const results = await repo.findSubspaces(parentId);
    return c.json({
      success: true,
      data: results.map(transformSpaceListItem),
    });
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * POST / - 创建子空间
 */
subspaces.post(
  '/',
  requirePermission('files:write'),
  zValidator('json', CreateSubspaceSchema),
  async (c) => {
    const { env } = c;
    const parentId = c.req.param('id');
    const { name, description, isPublic, password, expiresAt, template, templateData } =
      c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    try {
      // 验证父空间存在
      const parent = await repo.findById(parentId);
      if (!parent) {
        return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
      }

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
    } catch (err) {
      console.error(`${MSG.COMMON.CREATE_FAILED}:`, err);
      return c.json({ success: false, error: `${MSG.COMMON.CREATE_FAILED}: ${err.message}` }, 500);
    }
  }
);

export default subspaces;
