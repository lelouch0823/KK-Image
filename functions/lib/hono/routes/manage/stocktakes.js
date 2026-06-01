/**
 * 库存盘点 API (Stocktakes)
 * ==========================
 *
 * 支持盘点单的创建、查询、明细更新、库存调整和取消。
 *
 * @module routes/manage/stocktakes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { StocktakeRepository } from '../../../../repositories/StocktakeRepository.js';
import { NotFoundError, BadRequestError } from '../../errors.js';
import { requirePermission } from '../../middleware/auth.js';
import { requireEntity } from '../../_shared/route-helpers.js';

const app = new Hono();
app.use('*', requirePermission('products:manage'));

// ─── Schemas ───────────────────────────────────────────────

const CreateStocktakeSchema = z.object({
  notes: z.string().max(500).optional().nullable(),
});

const UpdateStocktakeSchema = z.object({
  notes: z.string().max(500).optional().nullable(),
});

const UpdateItemsSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().min(1),
    actualQty: z.number().int(),
    notes: z.string().max(200).optional(),
  })).min(1).max(500),
});

// ─── 盘点单列表 ───────────────────────────────────────────

/**
 * GET / - 盘点单列表
 */
app.get('/', async (c) => {
  const { env } = c;
  const status = c.req.query('status');
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;

  const repo = new StocktakeRepository(env.DB);
  const result = await repo.list({ status, page, limit });

  return c.json({
    success: true,
    data: result.items,
    total: result.total,
    page,
    limit,
  });
});

// ─── 创建盘点单 ───────────────────────────────────────────

/**
 * POST / - 创建盘点单（自动从当前库存填充明细）
 */
app.post('/', zValidator('json', CreateStocktakeSchema), async (c) => {
  const { env } = c;
  const body = c.req.valid('json');

  const repo = new StocktakeRepository(env.DB);
  const stocktake = await repo.create({
    notes: body.notes,
    createdBy: c.get('userId') || null,
  });

  return c.json({ success: true, data: stocktake }, 201);
});

// ─── 盘点单详情 ───────────────────────────────────────────

/**
 * GET /:id - 盘点单详情（含明细）
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const id = c.req.param('id');

  const repo = new StocktakeRepository(env.DB);
  const stocktake = await requireEntity(
    repo.findById(id),
    () => new NotFoundError('盘点单不存在')
  );

  return c.json({ success: true, data: stocktake });
});

// ─── 更新盘点单 ───────────────────────────────────────────

/**
 * PATCH /:id - 更新盘点单（备注）
 */
app.patch('/:id', zValidator('json', UpdateStocktakeSchema), async (c) => {
  const { env } = c;
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const repo = new StocktakeRepository(env.DB);
  await requireEntity(
    repo.findById(id),
    () => new NotFoundError('盘点单不存在')
  );

  const updated = await repo.update(id, { notes: body.notes });
  if (!updated) throw new BadRequestError('更新失败');

  return c.json({ success: true });
});

// ─── 更新盘点明细 ─────────────────────────────────────────

/**
 * POST /:id/items - 更新实际盘点数量
 */
app.post('/:id/items', zValidator('json', UpdateItemsSchema), async (c) => {
  const { env } = c;
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const repo = new StocktakeRepository(env.DB);
  await requireEntity(
    repo.findById(id),
    () => new NotFoundError('盘点单不存在')
  );

  const count = await repo.updateItems(id, body.items);

  return c.json({ success: true, data: { updatedCount: count } });
});

// ─── 执行库存调整 ─────────────────────────────────────────

/**
 * POST /:id/adjust - 根据盘点差异调整库存
 */
app.post('/:id/adjust', async (c) => {
  const { env } = c;
  const id = c.req.param('id');

  const repo = new StocktakeRepository(env.DB);
  await requireEntity(
    repo.findById(id),
    () => new NotFoundError('盘点单不存在')
  );

  const result = await repo.adjustInventory(id, {
    adjustedBy: c.get('userId') || null,
  });

  return c.json({ success: true, data: result });
});

// ─── 取消盘点单 ───────────────────────────────────────────

/**
 * POST /:id/cancel - 取消盘点单
 */
app.post('/:id/cancel', async (c) => {
  const { env } = c;
  const id = c.req.param('id');

  const repo = new StocktakeRepository(env.DB);
  await requireEntity(
    repo.findById(id),
    () => new NotFoundError('盘点单不存在')
  );

  await repo.cancel(id);

  return c.json({ success: true });
});

export default app;
