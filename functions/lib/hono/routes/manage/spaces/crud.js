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
import { generateId, generateShareToken, MSG, getShareUrl } from '../../../_shared/utils.js';
import {
  transformSpaceListItem,
  transformSpaceDetail,
  transformSpaceStats,
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

const UpdateSpaceSchema = CreateSpaceSchema.partial();

/**
 * GET / - 获取共享空间列表
 */
crud.get('/', async (c) => {
  const { env } = c;

  try {
    const { results } = await env.DB.prepare(
      `
            SELECT s.*, 
                (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count,
                f.storage_key as cover_storage_key
            FROM spaces s
            LEFT JOIN files f ON s.cover_file_id = f.id
            ORDER BY s.updated_at DESC
        `
    ).all();

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

  try {
    const space = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(spaceId).first();
    if (!space) {
      return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
    }

    const { results: files } = await env.DB.prepare(
      `
            SELECT f.* FROM files f
            JOIN space_files sf ON f.id = sf.file_id
            WHERE sf.space_id = ?
            ORDER BY sf.sort_order ASC, f.created_at DESC
        `
    )
      .bind(spaceId)
      .all();

    return c.json({
      success: true,
      data: transformSpaceDetail(space, files),
    });
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * GET /:id/stats - 获取空间统计
 */
crud.get('/:id/stats', async (c) => {
  const { env } = c;
  const spaceId = c.req.param('id');

  try {
    const space = await env.DB.prepare(
      `
            SELECT view_count, download_count FROM spaces WHERE id = ?
        `
    )
      .bind(spaceId)
      .first();

    const fileStats = await env.DB.prepare(
      `
            SELECT 
                COUNT(*) as file_count,
                COALESCE(SUM(f.size), 0) as total_size
            FROM files f
            JOIN space_files sf ON f.id = sf.file_id
            WHERE sf.space_id = ?
        `
    )
      .bind(spaceId)
      .first();

    // 生成最近7天趋势数据
    const trend = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      trend.push({ date: dateStr, count: 0 });
    }

    return c.json({
      success: true,
      data: transformSpaceStats(space, fileStats, trend),
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

    try {
      const spaceId = generateId();
      const shareToken = generateShareToken();
      const nowMs = Date.now();

      await env.DB.prepare(
        `
                INSERT INTO spaces (id, name, description, is_public, password, share_token, expires_at, template, template_data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
      )
        .bind(
          spaceId,
          name.trim(),
          description.trim(),
          isPublic ? 1 : 0,
          password || null,
          shareToken,
          expiresAt || null,
          template,
          JSON.stringify(templateData),
          nowMs,
          nowMs
        )
        .run();

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

    try {
      const space = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(spaceId).first();
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

      updates.push('updated_at = ?');
      values.push(Date.now());
      values.push(spaceId);

      await env.DB.prepare(`UPDATE spaces SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      const updated = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?')
        .bind(spaceId)
        .first();

      return c.json({
        success: true,
        data: {
          ...updated,
          isPublic: Boolean(updated.is_public),
          hasPassword: !!updated.password,
          shareUrl: getShareUrl(updated.share_token, 'space'),
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

  try {
    const space = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(spaceId).first();
    if (!space) {
      return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM space_files WHERE space_id = ?').bind(spaceId),
      env.DB.prepare('DELETE FROM spaces WHERE id = ?').bind(spaceId),
    ]);

    return c.json({ success: true, message: MSG.SPACE.DELETE_SUCCESS });
  } catch (err) {
    console.error(`${MSG.COMMON.DELETE_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.DELETE_FAILED}: ${err.message}` }, 500);
  }
});

export default crud;
