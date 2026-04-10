/**
 * 共享空间 CRUD 路由
 * GET / - 列表
 * GET /:id - 详情
 * GET /:id/stats - 统计
 * POST / - 创建
 * PUT /:id - 更新
 * DELETE /:id - 删除
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../../middleware/auth.js';
import { withCache } from '../../../middleware/cache.js';
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';
import { validateProductVariantBinding } from '../../../../../api/utils/validation.js';
import { generateId, generateShareToken, MSG, getShareUrl } from '../../../_shared/utils.js';
import {
  transformSpaceListItem,
  transformSpaceDetail,
} from './transformers.js';
import { NotFoundError } from '../../../errors.js';
import { invalidateSpaceCaches } from './cache-helpers.js';
import { appendOptionalUpdate, requireEntity } from '../../../_shared/route-helpers.js';
import {
  buildSpaceInvalidatePayload,
  normalizeSpaceCreateFields,
  requireSpace,
} from './route-helpers.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';

const crud = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/', domain: 'spaces', action: 'space.create', severity: 'high', targetType: 'space' },
  { method: 'PUT', path: '/:id', domain: 'spaces', action: 'space.update', severity: 'high', targetType: 'space' },
  { method: 'PATCH', path: '/:id', domain: 'spaces', action: 'space.update', severity: 'high', targetType: 'space' },
  { method: 'DELETE', path: '/:id', domain: 'spaces', action: 'space.delete', severity: 'critical', targetType: 'space' },
]);

// Schemas
const CreateSpaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  isPublic: z.boolean().optional().default(false),
  password: z.string().min(4).max(50).optional().nullable(),
  expiresAt: z.number().optional().nullable(),
  template: z.string().optional().default('gallery'),
  templateData: z.record(z.any()).optional().default({}),
  coverFileId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  shareMode: z.enum(['none', 'all', 'selected']).optional().default('none'),
  sharedSalespersonIds: z.array(z.string()).optional().default([]),
});

const UpdateSpaceSchema = CreateSpaceSchema.partial().extend({
  shareMode: z.enum(['none', 'all', 'selected']).optional(),
  sharedSalespersonIds: z.array(z.string()).optional(),
});

/**
 * GET / - 获取共享空间列表
 */
crud.get('/', withCache(30), async (c) => {
  const { env } = c;
  const repo = new SpaceRepository(env.DB);

  const results = await repo.findAll();
  return c.json({
    success: true,
    data: results.map(transformSpaceListItem),
  });
});

/**
 * GET /product/:productId - 获取与特定商品关联的共享空间
 */
crud.get('/product/:productId', withCache(30), async (c) => {
  const { env } = c;
  const productId = c.req.param('productId');
  const repo = new SpaceRepository(env.DB);

  const results = await repo.findByProductId(productId);
  return c.json({
    success: true,
    data: results.map(transformSpaceListItem),
  });
});

/**
 * GET /:id - 获取共享空间详情
 */
crud.get('/:id', withCache(30), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const repo = new SpaceRepository(env.DB);

  const result = await requireEntity(
    repo.getWithFiles(spaceId),
    () => new NotFoundError(MSG.SPACE.NOT_FOUND)
  );

  // 获取已分享的销售员列表 (用于前端显示)
  const sharedSalespersons = await repo.getSharedSalespersons(spaceId);

  return c.json({
    success: true,
    data: {
      ...transformSpaceDetail(result.space, result.files),
      shareMode: result.space.share_mode || 'none',
      sharedSalespersons: sharedSalespersons,
    },
  });
});

/**
 * GET /:id/stats - 获取空间统计
 * @query days - 趋势天数，支持 7 或 30，默认 7
 */
crud.get('/:id/stats', withCache(30), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const repo = new SpaceRepository(env.DB);
  const days = Math.min(Math.max(parseInt(c.req.query('days') || '7', 10), 1), 30);

  // 计算时间范围起点 (UTC+8 时区处理)
  const { getChinaDayStart, getChinaDateStr } = await import('../../../_shared/utils.js');
  const todayStart = getChinaDayStart();
  const startTimestamp = todayStart - (days - 1) * 86400000;

  const stats = await requireEntity(
    repo.getStats(spaceId, days, startTimestamp),
    () => new NotFoundError(MSG.SPACE.NOT_FOUND)
  );

  // 构建日期 -> 访问数的映射，补全缺失日期
  const trendMap = new Map(stats.trendData.map((d) => [d.date, d.count]));
  const trend = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getChinaDateStr(todayStart - i * 86400000);
    trend.push({ date: dateStr, count: trendMap.get(dateStr) || 0 });
  }

  return c.json({
    success: true,
    data: {
      total: {
        view_count: stats.viewCount,
        download_count: stats.downloadCount,
      },
      fileCount: stats.fileCount,
      totalSize: stats.totalSize,
      trend,
      days,
    },
  });
});

/**
 * POST / - 创建共享空间
 */
crud.post(
  '/',
  requirePermission('spaces:manage'),
  zValidator('json', CreateSpaceSchema),
  async (c) => {
    const { env } = c;
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
    } =
      c.req.valid('json');
    const repo = new SpaceRepository(env.DB);
    const { name: normalizedName, description: normalizedDescription } = normalizeSpaceCreateFields(name, description);

    const spaceId = generateId();
    const shareToken = generateShareToken();
    const nowMs = Date.now();

    const newSpace = {
      id: spaceId,
      name: normalizedName,
      description: normalizedDescription,
      isPublic,
      password: password || null,
      shareToken,
      expiresAt: expiresAt || null,
      template,
      templateData: JSON.stringify(templateData),
      productId,
      variantId: variantId || null,
      shareMode,
      createdAt: nowMs,
      updatedAt: nowMs,
    };
    // Spaces may keep referencing archived catalog entries, but new writes must still point to real entities.
    await validateProductVariantBinding(env.DB, newSpace.productId, newSpace.variantId);

    await repo.create(newSpace);
    if (Array.isArray(sharedSalespersonIds) && sharedSalespersonIds.length > 0) {
      await repo.updateSharedSalespersons(spaceId, sharedSalespersonIds);
    }
    await invalidateSpaceCaches(c, {
      ...buildSpaceInvalidatePayload({ spaceId, productIds: [newSpace.productId] }),
      eventType: 'space_created',
    });
    scheduleAuditEvent(c, {
      domain: 'spaces',
      action: 'space.create',
      result: 'success',
      severity: 'high',
      targetType: 'space',
      targetId: spaceId,
      target_label: normalizedName,
      summary: `Created space ${normalizedName}`,
      metadata: {
        productId: newSpace.productId,
        variantId: newSpace.variantId,
        shareMode: newSpace.shareMode,
      },
    });

    return c.json(
      {
        success: true,
        data: {
          id: spaceId,
          name: normalizedName,
          description: normalizedDescription,
          isPublic,
          shareToken,
          shareUrl: getShareUrl(shareToken, 'space'),
          expiresAt,
          template,
          shareMode: newSpace.shareMode,
          createdAt: nowMs,
        },
      },
      201
    );
  }
);

/**
 * PUT /:id - 更新共享空间
 */
crud.on(
  ['PUT', 'PATCH'],
  '/:id',
  requirePermission('spaces:manage'),
  zValidator('json', UpdateSpaceSchema),
  async (c) => {
    const { env } = c;
    const spaceId = c.req.param('id');
    const data = c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    const space = await requireSpace(repo, spaceId);

    const updates = [];
    const values = [];

    appendOptionalUpdate(updates, values, 'name = ?', data.name, (value) => value.trim());
    appendOptionalUpdate(updates, values, 'description = ?', data.description, (value) => value.trim());
    appendOptionalUpdate(updates, values, 'is_public = ?', data.isPublic, (value) => (value ? 1 : 0));
    appendOptionalUpdate(updates, values, 'password = ?', data.password, (value) => value || null);
    appendOptionalUpdate(updates, values, 'expires_at = ?', data.expiresAt);
    appendOptionalUpdate(updates, values, 'cover_file_id = ?', data.coverFileId, (value) => value || null);
    appendOptionalUpdate(updates, values, 'template = ?', data.template);
    appendOptionalUpdate(updates, values, 'template_data = ?', data.templateData, (value) => JSON.stringify(value));
    appendOptionalUpdate(updates, values, 'product_id = ?', data.productId, (value) => value || null);
    appendOptionalUpdate(updates, values, 'variant_id = ?', data.variantId, (value) => value || null);
    const nextProductId = data.productId !== undefined ? (data.productId || null) : (space.product_id || null);
    const nextVariantId = data.variantId !== undefined ? (data.variantId || null) : (space.variant_id || null);
    // Preserve historical archived bindings by validating existence without requiring active status.
    await validateProductVariantBinding(env.DB, nextProductId, nextVariantId);
    // 处理新的分享模式
    appendOptionalUpdate(updates, values, 'share_mode = ?', data.shareMode);

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(spaceId);

    const updated = await repo.update(spaceId, updates, values);

    // 处理选择性分享的销售员列表
    if (data.sharedSalespersonIds !== undefined) {
      await repo.updateSharedSalespersons(spaceId, data.sharedSalespersonIds);
    }

    await invalidateSpaceCaches(c, {
      ...buildSpaceInvalidatePayload({
        spaceId,
        space,
        productIds: [space.product_id, nextProductId],
      }),
      eventType: 'space_updated',
    });
    scheduleAuditEvent(c, {
      domain: 'spaces',
      action: 'space.update',
      result: 'success',
      severity: 'high',
      targetType: 'space',
      targetId: spaceId,
      target_label: updated.name || spaceId,
      summary: `Updated space ${updated.name || spaceId}`,
      metadata: { productId: nextProductId, variantId: nextVariantId },
    });

    return c.json({
      success: true,
      data: {
        ...updated,
        isPublic: Boolean(updated.is_public),
        hasPassword: !!updated.password,
        shareUrl: getShareUrl(updated.share_token, 'space'),
        shareMode: updated.share_mode || 'none',
      },
    });
  }
);

/**
 * DELETE /:id - 删除共享空间
 */
crud.delete('/:id', requirePermission('spaces:manage'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const repo = new SpaceRepository(env.DB);

  const space = await requireSpace(repo, spaceId);

  await repo.delete(spaceId);
  await invalidateSpaceCaches(c, {
    ...buildSpaceInvalidatePayload({ spaceId, space, productIds: [space.product_id] }),
    eventType: 'space_deleted',
  });
  scheduleAuditEvent(c, {
    domain: 'spaces',
    action: 'space.delete',
    result: 'success',
    severity: 'critical',
    targetType: 'space',
    targetId: spaceId,
    target_label: space.name,
    summary: `Deleted space ${space.name}`,
  });

  return c.json({ success: true, message: MSG.SPACE.DELETE_SUCCESS });
});

export default crud;
