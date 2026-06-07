/**
 * 子空间操作路由
 * GET /:id/subspaces - 获取子空间列表
 * POST /:id/subspaces - 创建子空间
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../../middleware/auth.js';
import { withCache } from '../../../middleware/cache.js';
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';
import { validateProductVariantBinding } from '../../../../../api/utils/validation.js';
import { generateId, generateShareToken, getShareUrl } from '../../../../../_shared/utils.js';
import { encodeSharePasswordForStorage } from '../../../../../api/utils/id.js';
import { transformSpaceListItem } from './transformers.js';
import { invalidateSpaceCaches } from './cache-helpers.js';
import {
  buildSpaceInvalidatePayload,
  normalizeSpaceCreateFields,
  requireSpace,
} from './route-helpers.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';

const subspaces = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/',
    domain: 'spaces',
    action: 'space.subspace.create',
    severity: 'high',
    targetType: 'space',
  },
]);

// Schema
const CreateSubspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  isPublic: z.boolean().optional().default(false),
  password: z.string().min(4).max(50).optional().nullable(),
  expiresAt: z.number().optional().nullable(),
  template: z.string().optional().default('gallery'),
  templateData: z.record(z.any()).optional().default({}),
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  shareMode: z.enum(['none', 'all', 'selected']).optional().default('none'),
  sharedSalespersonIds: z.array(z.string()).optional().default([]),
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
    const {
      name,
      description,
      isPublic,
      password,
      expiresAt,
      template,
      templateData,
      productId,
      variantId,
      shareMode,
      sharedSalespersonIds,
    } = c.req.valid('json');
    const repo = new SpaceRepository(env.DB);
    const pepper = env?.PASSWORD_PEPPER || env?.JWT_SECRET;
    const { name: normalizedName, description: normalizedDescription } = normalizeSpaceCreateFields(
      name,
      description
    );

    // 验证父空间存在
    const parent = await requireSpace(repo, parentId);

    const spaceId = generateId();
    const shareToken = generateShareToken();
    const nowMs = Date.now();
    const binding = await validateProductVariantBinding(
      env.DB,
      productId || null,
      variantId || null,
      {
        checkActive: true,
        variantSelectPolicy: 'in_stock_only',
      }
    );

    const newSubspace = {
      id: spaceId,
      parentId,
      name: normalizedName,
      description: normalizedDescription,
      isPublic,
      password: await encodeSharePasswordForStorage(password, pepper),
      shareToken,
      expiresAt: expiresAt || null,
      template,
      templateData: JSON.stringify(templateData),
      shareMode,
      productId: binding.normalizedProductId,
      variantId: binding.normalizedVariantId,
      createdAt: nowMs,
      updatedAt: nowMs,
    };

    await repo.createSubspace(newSubspace);
    if (Array.isArray(sharedSalespersonIds) && sharedSalespersonIds.length > 0) {
      await repo.updateSharedSalespersons(spaceId, sharedSalespersonIds);
    }
    await invalidateSpaceCaches(c, {
      ...buildSpaceInvalidatePayload({
        spaceId: parentId,
        parentId,
        productIds: [parent.product_id, newSubspace.productId],
      }),
      eventType: 'space_subspace_created',
    });
    scheduleAuditEvent(c, {
      domain: 'spaces',
      action: 'space.subspace.create',
      result: 'success',
      severity: 'high',
      targetType: 'space',
      targetId: spaceId,
      target_label: normalizedName,
      summary: `Created subspace ${normalizedName}`,
      metadata: {
        parentId,
        productId: newSubspace.productId,
        variantId: newSubspace.variantId,
        shareMode: newSubspace.shareMode,
      },
    });

    return c.json(
      {
        success: true,
        data: {
          id: spaceId,
          parentId,
          name: normalizedName,
          description: normalizedDescription,
          isPublic,
          shareToken,
          shareUrl: getShareUrl(shareToken, 'space'),
          template,
          shareMode: newSubspace.shareMode,
          productId: newSubspace.productId,
          variantId: newSubspace.variantId,
          createdAt: nowMs,
        },
      },
      201
    );
  }
);

export default subspaces;
