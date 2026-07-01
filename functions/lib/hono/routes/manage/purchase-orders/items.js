/**
 * 采购单路由 - 明细 CRUD
 * =======================
 *
 * POST items, PATCH item, DELETE item
 *
 * @module routes/manage/purchase-orders/items
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PurchaseOrderRepository } from '../../../../../repositories/PurchaseOrderRepository.js';
import {
  validatePurchaseOrderPreOrderBinding,
  validatePurchaseOrderUnitCost,
  validatePurchaseOrderVariantItems,
} from '../../../../../services/purchase-order-item-validation.js';
import { BadRequestError } from '../../../errors.js';
import {
  AddPurchaseOrderItemsSchema,
  UpdatePurchaseOrderItemSchema,
} from '../../../schemas/purchase-order.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import {
  publishPurchaseOrderCacheEvent,
  requireDraftPurchaseOrder,
  requireMutationSuccess,
  validateExistingItemQuantityUpdate,
} from './helpers.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/:id/items',
    domain: 'purchase-orders',
    action: 'purchase_order.item.create',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'PATCH',
    path: '/:id/items/:itemId',
    domain: 'purchase-orders',
    action: 'purchase_order.item.update',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'DELETE',
    path: '/:id/items/:itemId',
    domain: 'purchase-orders',
    action: 'purchase_order.item.delete',
    severity: 'high',
    targetType: 'purchase_order',
  },
]);

/**
 * POST /:id/items — 添加明细
 * Body: { items: [{ product_id, pre_order_id?, quantity, unit_cost }] }
 */
app.post('/:id/items', zValidator('json', AddPurchaseOrderItemsSchema), async (c) => {
  const poId = c.req.param('id');
  const body = c.req.valid('json');
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单存在且为草稿状态
  await requireDraftPurchaseOrder(repo, poId, '添加明细');

  if (!body.items || body.items.length === 0) {
    throw new BadRequestError('请提供至少一条明细项');
  }
  await validatePurchaseOrderVariantItems(c.env.DB, body.items);
  await validatePurchaseOrderPreOrderBinding(c.env.DB, body.items, { currentPoId: poId, repo });

  const ids = await repo.addItems(poId, body.items);

  await publishPurchaseOrderCacheEvent(c, {
    eventType: 'purchase_order_item_created',
    poId,
    payload: {
      item_count: ids.length,
    },
  });
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.item.create',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Added ${ids.length} items to purchase order ${poId}`,
    metadata: { count: ids.length },
  });

  return c.json({ success: true, data: { created: ids.length } }, 201);
});

/**
 * PATCH /:id/items/:itemId — 更新单条明细（数量/单价）
 * Body: { quantity?, unit_cost? }
 */
app.patch('/:id/items/:itemId', zValidator('json', UpdatePurchaseOrderItemSchema), async (c) => {
  const poId = c.req.param('id');
  const body = c.req.valid('json');
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单存在且为草稿状态
  await requireDraftPurchaseOrder(repo, poId, '修改明细');

  if (body.variant_id !== undefined) {
    throw new BadRequestError('现有采购明细不允许修改规格，请删除后重新添加');
  }

  const existingItem = await repo.findItemById(poId, c.req.param('itemId'));
  if (!existingItem) {
    throw new BadRequestError('明细不存在');
  }

  validatePurchaseOrderUnitCost(body.unit_cost);
  await validateExistingItemQuantityUpdate(c.env.DB, existingItem, body.quantity);

  const updated = await repo.updateItem(poId, c.req.param('itemId'), body);
  requireMutationSuccess(updated, '明细不存在');

  await publishPurchaseOrderCacheEvent(c, {
    eventType: 'purchase_order_item_updated',
    poId,
    payload: {
      item_id: c.req.param('itemId'),
      fields: Object.keys(body || {}),
    },
  });
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.item.update',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Updated purchase order item ${c.req.param('itemId')}`,
    metadata: body,
  });

  return c.json({ success: true });
});

/**
 * DELETE /:id/items/:itemId — 删除明细
 */
app.delete('/:id/items/:itemId', async (c) => {
  const poId = c.req.param('id');
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单状态
  await requireDraftPurchaseOrder(repo, poId, '删除明细');

  const removed = await repo.removeItem(poId, c.req.param('itemId'));
  requireMutationSuccess(removed, '明细不存在');

  await publishPurchaseOrderCacheEvent(c, {
    eventType: 'purchase_order_item_deleted',
    poId,
    payload: {
      item_id: c.req.param('itemId'),
    },
  });
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.item.delete',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Deleted purchase order item ${c.req.param('itemId')}`,
  });

  return c.json({ success: true });
});

export default app;
