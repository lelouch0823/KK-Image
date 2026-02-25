/**
 * 采购单管理 API (Purchase Orders)
 * ==================================
 *
 * 支持采购单的创建、查询、状态变更、明细管理和成本分摊。
 * 采购单状态变更时自动级联更新关联预订单状态。
 *
 * @module routes/manage/purchase-orders
 */

import { Hono } from 'hono';
import { PurchaseOrderRepository } from '../../../../repositories/PurchaseOrderRepository.js';
import { PurchaseOrderService } from '../../../../services/PurchaseOrderService.js';
import { validateOrderQuantity } from '../../../../services/purchase-order-constraints.js';
import { NotFoundError, BadRequestError } from '../../errors.js';

const app = new Hono();

async function validateVariantItems(db, items = []) {
  if (!items || items.length === 0) return;
  const variantIds = [...new Set(items.map((item) => item.variant_id).filter(Boolean))];
  if (variantIds.length !== items.length) {
    // duplicates are allowed, but missing variant_id is not
    const hasMissing = items.some((item) => !item.variant_id);
    if (hasMissing) throw new BadRequestError('采购单明细必须包含 variant_id');
  }

  if (items.some((item) => !item.product_id || !item.variant_id)) {
    throw new BadRequestError('采购单明细必须包含 product_id 与 variant_id');
  }

  const placeholders = variantIds.map(() => '?').join(',');
  const { results } = await db.prepare(`
    SELECT id, product_id, status,
           COALESCE(moq, 1) AS moq,
           COALESCE(pack_size, 1) AS pack_size,
           COALESCE(order_step, 1) AS order_step
    FROM product_variants
    WHERE id IN (${placeholders})
  `).bind(...variantIds).all();
  const variantMap = new Map(results.map((row) => [row.id, row]));

  for (const item of items) {
    const variant = variantMap.get(item.variant_id);
    if (!variant) {
      throw new BadRequestError(`变体不存在: ${item.variant_id}`);
    }
    if (variant.product_id !== item.product_id) {
      throw new BadRequestError('variant_id 与 product_id 不匹配');
    }
    if (String(variant.status || '').toLowerCase() !== 'active') {
      throw new BadRequestError('仅可采购 active 变体');
    }
    const result = validateOrderQuantity(item.quantity || 1, {
      moq: variant.moq,
      orderStep: variant.order_step,
      packSize: variant.pack_size,
    });
    if (!result.valid) {
      throw new BadRequestError(`${result.reason}（建议数量: ${result.suggestedQuantity}）`);
    }
  }
}

// ─── 列表 & 统计 ───────────────────────────────────────

/**
 * GET / — 采购单列表
 * Query: status, page, limit
 */
app.get('/', async (c) => {
  const url = new URL(c.req.url);
  const filters = {
    status: url.searchParams.get('status') || '',
    page: url.searchParams.get('page') || 1,
    limit: url.searchParams.get('limit') || 20,
  };

  const repo = new PurchaseOrderRepository(c.env.DB);
  const result = await repo.list(filters);

  return c.json({ success: true, data: result });
});

/**
 * GET /stats — 采购统计概览
 */
app.get('/stats', async (c) => {
  const repo = new PurchaseOrderRepository(c.env.DB);
  const stats = await repo.getStats();
  return c.json({ success: true, data: stats });
});

/**
 * GET /suggestions — 智能采购建议
 * 基于订货总览缺口，推荐优先采购的商品及关联订单
 */
app.get('/suggestions', async (c) => {
  const service = new PurchaseOrderService(c.env.DB);
  const suggestions = await service.getSuggestions();
  return c.json({ success: true, data: suggestions });
});

// ─── 详情 ──────────────────────────────────────────────

/**
 * GET /:id — 采购单详情 (含明细)
 */
app.get('/:id', async (c) => {
  const repo = new PurchaseOrderRepository(c.env.DB);
  const po = await repo.findById(c.req.param('id'));

  if (!po) throw new NotFoundError('采购单不存在');

  return c.json({ success: true, data: po });
});

// ─── 创建 ──────────────────────────────────────────────

/**
 * POST / — 创建采购单 (草稿)
 * Body: { remark?, currency?, allocation_method?, estimated_shipping_cost?, estimated_tariff_cost?, items? }
 */
app.post('/', async (c) => {
  const body = await c.req.json();
  const repo = new PurchaseOrderRepository(c.env.DB);

  const po = await repo.create({
    remark: body.remark,
    currency: body.currency,
    allocation_method: body.allocation_method,
    estimated_shipping_cost: body.estimated_shipping_cost,
    estimated_tariff_cost: body.estimated_tariff_cost,
  });

  // 如果同时传入了明细项，一并添加
  if (body.items && body.items.length > 0) {
    await validateVariantItems(c.env.DB, body.items);
    await repo.addItems(po.id, body.items);
  }

  // 返回完整的采购单
  const fullPo = await repo.findById(po.id);
  return c.json({ success: true, data: fullPo }, 201);
});

/**
 * POST /from-orders — 从预订单快速创建采购单
 * Body: { order_ids: string[], remark?, allocation_method? }
 */
app.post('/from-orders', async (c) => {
  const body = await c.req.json();

  if (!body.order_ids || body.order_ids.length === 0) {
    throw new BadRequestError('请至少选择一个预订单');
  }

  const service = new PurchaseOrderService(c.env.DB);
  const po = await service.createFromOrders(body.order_ids, {
    remark: body.remark,
    allocation_method: body.allocation_method,
    estimated_shipping_cost: body.estimated_shipping_cost,
    estimated_tariff_cost: body.estimated_tariff_cost,
  });

  return c.json({ success: true, data: po }, 201);
});

// ─── 更新 ──────────────────────────────────────────────

/**
 * PUT /:id — 更新采购单基本信息
 * Body: { remark?, currency?, allocation_method?, estimated_shipping_cost?, estimated_tariff_cost?, actual_shipping_cost?, actual_tariff_cost? }
 */
app.put('/:id', async (c) => {
  const body = await c.req.json();
  const repo = new PurchaseOrderRepository(c.env.DB);

  const updated = await repo.update(c.req.param('id'), body);
  if (!updated) throw new NotFoundError('未找到采购单或无有效字段更新');

  const po = await repo.findById(c.req.param('id'));
  return c.json({ success: true, data: po });
});

/**
 * PATCH /:id/status — 变更采购单状态 (触发级联)
 * Body: { status: 'ordered' | 'shipping' | 'arrived' | 'completed' | 'cancelled' }
 */
app.patch('/:id/status', async (c) => {
  const body = await c.req.json();

  if (!body.status) throw new BadRequestError('缺少目标状态 status 字段');

  const service = new PurchaseOrderService(c.env.DB);
  // Service 内部会校验合法性并抛出 BadRequestError / NotFoundError
  const result = await service.updateStatus(c.req.param('id'), body.status);

  return c.json({
    success: true,
    data: {
      ...result,
      message: result.cascadedOrders > 0
        ? `状态已更新，同步更新了 ${result.cascadedOrders} 个预订单`
        : '状态已更新',
    },
  });
});

// ─── 明细操作 ──────────────────────────────────────────

/**
 * POST /:id/items — 添加明细
 * Body: { items: [{ product_id, pre_order_id?, quantity, unit_cost }] }
 */
app.post('/:id/items', async (c) => {
  const body = await c.req.json();
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单存在且为草稿状态
  const po = await repo.findById(c.req.param('id'));
  if (!po) throw new NotFoundError('采购单不存在');
  if (po.status !== 'draft') throw new BadRequestError('仅草稿状态允许添加明细');

  if (!body.items || body.items.length === 0) {
    throw new BadRequestError('请提供至少一条明细项');
  }
  await validateVariantItems(c.env.DB, body.items);

  const ids = await repo.addItems(c.req.param('id'), body.items);

  return c.json({ success: true, data: { created: ids.length } }, 201);
});

/**
 * PATCH /:id/items/:itemId — 更新单条明细（数量/单价）
 * Body: { quantity?, unit_cost? }
 */
app.patch('/:id/items/:itemId', async (c) => {
  const body = await c.req.json();
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单存在且为草稿状态
  const po = await repo.findById(c.req.param('id'));
  if (!po) throw new NotFoundError('采购单不存在');
  if (po.status !== 'draft') throw new BadRequestError('仅草稿状态允许修改明细');

  const updated = await repo.updateItem(c.req.param('itemId'), body);
  if (!updated) throw new NotFoundError('明细不存在');

  return c.json({ success: true });
});

/**
 * DELETE /:id/items/:itemId — 删除明细
 */
app.delete('/:id/items/:itemId', async (c) => {
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单状态
  const po = await repo.findById(c.req.param('id'));
  if (!po) throw new NotFoundError('采购单不存在');
  if (po.status !== 'draft') throw new BadRequestError('仅草稿状态允许删除明细');

  const removed = await repo.removeItem(c.req.param('itemId'));
  if (!removed) throw new NotFoundError('明细不存在');

  return c.json({ success: true });
});

// ─── 成本分摊 ──────────────────────────────────────────

/**
 * POST /:id/allocate — 手动触发成本分摊 (用于填写实际费用后重新计算)
 */
app.post('/:id/allocate', async (c) => {
  const service = new PurchaseOrderService(c.env.DB);
  await service.allocateCosts(c.req.param('id'));

  const repo = new PurchaseOrderRepository(c.env.DB);
  const po = await repo.findById(c.req.param('id'));
  if (!po) throw new NotFoundError('采购单不存在');

  return c.json({ success: true, data: po });
});

export default app;
