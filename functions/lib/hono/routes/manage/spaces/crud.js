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
import { SpaceRepository } from '../../../../../repositories/SpaceRepository.js';
import { generateId, generateShareToken, MSG, getShareUrl } from '../../../_shared/utils.js';
import {
  transformSpaceListItem,
  transformSpaceDetail,
} from './transformers.js';

const crud = new Hono();

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
});

const UpdateSpaceSchema = CreateSpaceSchema.partial().extend({
  shareMode: z.enum(['none', 'all', 'selected']).optional(),
  sharedSalespersonIds: z.array(z.string()).optional(),
});

/**
 * GET / - 获取共享空间列表
 */
crud.get('/', async (c) => {
  const { env } = c;
  const repo = new SpaceRepository(env.DB);

  try {
    const results = await repo.findAll();
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
 * GET /:id - 获取共享空间详情
 */
crud.get('/:id', async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const repo = new SpaceRepository(env.DB);

  try {
    const result = await repo.getWithFiles(spaceId);
    if (!result) {
      return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
    }

    // 获取已分享的销售员列表 (用于前端显示)
    const sharedSalespersons = await env.DB.prepare(`
      SELECT sp.id, sp.name, sp.store
      FROM space_salesperson_shares sss
      JOIN salespersons sp ON sss.salesperson_id = sp.id
      WHERE sss.space_id = ?
    `).bind(spaceId).all();

    return c.json({
      success: true,
      data: {
        ...transformSpaceDetail(result.space, result.files),
        shareMode: result.space.share_mode || 'none',
        sharedSalespersons: sharedSalespersons.results || [],
      },
    });
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * GET /:id/stats - 获取空间统计
 * @query days - 趋势天数，支持 7 或 30，默认 7
 */
crud.get('/:id/stats', async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const repo = new SpaceRepository(env.DB);
  const days = Math.min(Math.max(parseInt(c.req.query('days') || '7', 10), 1), 30);

  try {
    // 计算时间范围起点 (UTC+8 时区处理)
    const { getChinaDayStart, getChinaDateStr } = await import('../../../_shared/utils.js');
    const todayStart = getChinaDayStart();
    const startTimestamp = todayStart - (days - 1) * 86400000;

    const stats = await repo.getStats(spaceId, days, startTimestamp);
    if (!stats) {
      return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
    }

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
  } catch (err) {
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * POST / - 创建共享空间
 */
crud.post(
  '/',
  requirePermission('files:write'),
  zValidator('json', CreateSpaceSchema),
  async (c) => {
    const { env } = c;
    const { name, description, isPublic, password, expiresAt, template, templateData } =
      c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    try {
      const spaceId = generateId();
      const shareToken = generateShareToken();
      const nowMs = Date.now();

      const newSpace = {
        id: spaceId,
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

      await repo.create(newSpace);

      return c.json(
        {
          success: true,
          data: {
            id: spaceId,
            name: name.trim(),
            description: description.trim(),
            isPublic,
            shareToken,
            shareUrl: getShareUrl(shareToken, 'space'),
            expiresAt,
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

/**
 * PUT /:id - 更新共享空间
 */
crud.put(
  '/:id',
  requirePermission('files:write'),
  zValidator('json', UpdateSpaceSchema),
  async (c) => {
    const { env } = c;
    const spaceId = c.req.param('id');
    const data = c.req.valid('json');
    const repo = new SpaceRepository(env.DB);

    try {
      const space = await repo.findById(spaceId);
      if (!space) {
        return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
      }

      const updates = [];
      const values = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name.trim());
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description.trim());
      }
      if (data.isPublic !== undefined) {
        updates.push('is_public = ?');
        values.push(data.isPublic ? 1 : 0);
      }
      if (data.password !== undefined) {
        updates.push('password = ?');
        values.push(data.password || null);
      }
      if (data.expiresAt !== undefined) {
        updates.push('expires_at = ?');
        values.push(data.expiresAt);
      }
      if (data.coverFileId !== undefined) {
        updates.push('cover_file_id = ?');
        values.push(data.coverFileId || null);
      }
      if (data.template !== undefined) {
        updates.push('template = ?');
        values.push(data.template);
      }
      if (data.templateData !== undefined) {
        updates.push('template_data = ?');
        values.push(JSON.stringify(data.templateData));
      }
      // 处理新的分享模式
      if (data.shareMode !== undefined) {
        updates.push('share_mode = ?');
        values.push(data.shareMode);
      }

      updates.push('updated_at = ?');
      values.push(Date.now());
      values.push(spaceId);

      const updated = await repo.update(spaceId, updates, values);

      // 处理选择性分享的销售员列表
      if (data.sharedSalespersonIds !== undefined) {
        const nowMs = Date.now();
        // 先清除旧的关联
        await env.DB.prepare('DELETE FROM space_salesperson_shares WHERE space_id = ?')
          .bind(spaceId)
          .run();

        // 批量插入新关联
        if (data.sharedSalespersonIds.length > 0) {
          const insertStmt = env.DB.prepare(
            'INSERT INTO space_salesperson_shares (space_id, salesperson_id, shared_at) VALUES (?, ?, ?)'
          );
          await env.DB.batch(
            data.sharedSalespersonIds.map((spId) => insertStmt.bind(spaceId, spId, nowMs))
          );
        }
      }

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
    } catch (err) {
      console.error(`${MSG.COMMON.UPDATE_FAILED}:`, err);
      return c.json({ success: false, error: `${MSG.COMMON.UPDATE_FAILED}: ${err.message}` }, 500);
    }
  }
);

/**
 * DELETE /:id - 删除共享空间
 */
crud.delete('/:id', requirePermission('files:delete'), async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');
  const repo = new SpaceRepository(env.DB);

  try {
    const space = await repo.findById(spaceId);
    if (!space) {
      return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
    }

    await repo.delete(spaceId);

    return c.json({ success: true, message: MSG.SPACE.DELETE_SUCCESS });
  } catch (err) {
    console.error(`${MSG.COMMON.DELETE_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.DELETE_FAILED}: ${err.message}` }, 500);
  }
});

export default crud;
