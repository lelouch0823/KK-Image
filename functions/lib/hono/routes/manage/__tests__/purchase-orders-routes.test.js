import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { BadRequestError } from '../../../errors.js';

const mocks = vi.hoisted(() => ({
  repoFindById: vi.fn(),
  repoFindItemById: vi.fn(),
  repoCreate: vi.fn(),
  repoUpdate: vi.fn(),
  repoAddItems: vi.fn(),
  repoDeleteIfEmptyDraft: vi.fn(),
  repoFindActiveBindingsByPreOrderIds: vi.fn(),
  repoUpdateItem: vi.fn(),
  repoRemoveItem: vi.fn(),
  serviceUpdateStatus: vi.fn(),
  serviceCreateFromOrders: vi.fn(),
  serviceAllocateCosts: vi.fn(),
  domainRecordReceipts: vi.fn(),
  reversalReverseReceipt: vi.fn(),
  shortageCloseShortages: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  scheduleCacheInvalidation: vi.fn(),
  randomUUID: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../repositories/PurchaseOrderRepository.js', () => ({
  PurchaseOrderRepository: vi.fn(() => ({
    findById: mocks.repoFindById,
    findItemById: mocks.repoFindItemById,
    create: mocks.repoCreate,
    update: mocks.repoUpdate,
    addItems: mocks.repoAddItems,
    deleteIfEmptyDraft: mocks.repoDeleteIfEmptyDraft,
    findActiveBindingsByPreOrderIds: mocks.repoFindActiveBindingsByPreOrderIds,
    updateItem: mocks.repoUpdateItem,
    removeItem: mocks.repoRemoveItem,
    list: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })),
    getStats: vi.fn(async () => ({})),
  })),
}));

vi.mock('../../../../../services/PurchaseOrderService.js', () => ({
  PurchaseOrderService: vi.fn(() => ({
    updateStatus: mocks.serviceUpdateStatus,
    getSuggestions: vi.fn(async () => []),
    createFromOrders: mocks.serviceCreateFromOrders,
    allocateCosts: mocks.serviceAllocateCosts,
  })),
}));

vi.mock('../../../../../services/OrderProcurementDomainService.js', () => ({
  OrderProcurementDomainService: vi.fn(() => ({
    recordPurchaseOrderReceipts: mocks.domainRecordReceipts,
  })),
}));

vi.mock('../../../../../services/OrderProcurementReceiptReversalService.js', () => ({
  OrderProcurementReceiptReversalService: vi.fn(() => ({
    reverseReceipt: mocks.reversalReverseReceipt,
  })),
}));

vi.mock('../../../../../services/PurchaseOrderShortageClosureService.js', () => ({
  PurchaseOrderShortageClosureService: vi.fn(() => ({
    closeShortages: mocks.shortageCloseShortages,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getPurchaseOrderCacheUrls: vi.fn(() => []),
  getOrderAnalyticsCacheUrls: vi.fn(() => []),
}));

vi.mock('../../../_shared/route-helpers.js', () => ({
  requireEntity: async (promise, onNotFound) => {
    const entity = await promise;
    if (!entity) throw onNotFound();
    return entity;
  },
  scheduleCacheInvalidation: mocks.scheduleCacheInvalidation,
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import purchaseOrdersApp from '../purchase-orders.js';

function createDb({ variantRows = [], orderRows = [], poBindingRows = [] } = {}) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn(() => ({
        all: vi.fn(async () => {
          if (sql.includes('FROM product_variants')) return { results: variantRows };
          if (sql.includes('FROM orders')) return { results: orderRows };
          if (sql.includes('FROM purchase_order_items poi')) return { results: poBindingRows };
          return { results: [] };
        }),
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      })),
    })),
  };
}

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/manage/purchase-orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'admin', permissions: ['products:manage'] });
    await next();
  });
  app.route('/api/manage/purchase-orders', purchaseOrdersApp);
  return app;
}

describe('manage purchase-orders routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => mocks.randomUUID());
    mocks.randomUUID.mockReturnValue('generated-idempotency-key');
    mocks.repoFindById.mockResolvedValue({ id: 'po-1', status: 'draft', items: [] });
    mocks.repoFindItemById.mockResolvedValue({
      id: 'item-1',
      po_id: 'po-1',
      product_id: 'prod-1',
      variant_id: 'var-1',
      pre_order_id: null,
      quantity: 10,
      unit_cost: 5,
    });
    mocks.repoCreate.mockResolvedValue({ id: 'po-1', po_no: 'PO-1', status: 'draft' });
    mocks.repoUpdate.mockResolvedValue(true);
    mocks.repoAddItems.mockResolvedValue(['poi-1']);
    mocks.repoDeleteIfEmptyDraft.mockResolvedValue(true);
    mocks.repoFindActiveBindingsByPreOrderIds.mockResolvedValue([]);
    mocks.repoUpdateItem.mockResolvedValue(true);
    mocks.repoRemoveItem.mockResolvedValue(true);
    mocks.serviceUpdateStatus.mockResolvedValue({
      success: true,
      cascadedOrders: 2,
      changedOrderIds: ['o-1', 'o-2'],
      targetProcurementStatus: 'ordered',
    });
    mocks.serviceCreateFromOrders.mockResolvedValue({ id: 'po-2', po_no: 'PO-2', status: 'draft' });
    mocks.serviceAllocateCosts.mockResolvedValue(undefined);
    mocks.domainRecordReceipts.mockResolvedValue({ purchase_order_id: 'po-1', receipt_count: 1 });
    mocks.reversalReverseReceipt.mockResolvedValue({ purchase_order_id: 'po-1', receipt_id: 'receipt-1', reversal_qty: 2 });
    mocks.shortageCloseShortages.mockResolvedValue({
      purchase_order_id: 'po-1',
      closed_count: 1,
      items: [{ purchase_order_item_id: 'poi-1', close_qty: 2 }],
      changedOrderStatuses: [],
      changedOrderProgressions: [
        {
          orderId: 'o-1',
          orderLineId: 'line-1',
          orderLineDisplayStatus: 'partially_received',
          procurementStatus: 'partially_arrived',
        },
      ],
    });
  });

  it('enqueues purchase-order create cache side effects through outbox', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: 'draft' }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_created',
        aggregate_type: 'purchase_order',
        aggregate_id: 'po-1',
        payload: expect.objectContaining({
          purchase_order_id: 'po-1',
        }),
      }),
    ]);
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });

  it('enqueues purchase-order create-from-orders cache side effects through outbox', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/from-orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: ['o-1'] }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_created_from_orders',
        aggregate_id: 'po-2',
      }),
    ]);
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
  });

  it('dedupes create-from-orders order ids before publishing side effects and audit metadata', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/from-orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: ['o-1', 'o-1', 'o-2', '', null] }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.serviceCreateFromOrders).toHaveBeenCalledWith(['o-1', 'o-2'], expect.any(Object));
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_created_from_orders',
        payload: expect.objectContaining({
          order_ids: ['o-1', 'o-2'],
        }),
      }),
    ]);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: { orderIds: ['o-1', 'o-2'] },
      })
    );
    expect(waitUntil).toHaveBeenCalled();
  });

  it('enqueues purchase-order update cache side effects through outbox', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: 'updated' }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_updated',
        aggregate_id: 'po-1',
      }),
    ]);
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
  });

  it('recomputes allocation when settlement fields change on a completed purchase order', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();
    mocks.repoFindById.mockResolvedValue({ id: 'po-1', status: 'completed', items: [] });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_shipping_cost: 18.5 }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.serviceAllocateCosts).toHaveBeenCalledWith('po-1');
  });

  it('rolls completed purchase-order field updates back when cost reallocation fails', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();
    mocks.repoFindById
      .mockResolvedValueOnce({
        id: 'po-1',
        status: 'completed',
        remark: 'before',
        actual_shipping_cost: 10,
        actual_tariff_cost: 5,
        estimated_shipping_cost: 0,
        estimated_tariff_cost: 0,
        currency: 'CNY',
        allocation_method: 'by_quantity',
        items: [],
      })
      .mockResolvedValueOnce({
        id: 'po-1',
        status: 'completed',
        remark: 'after',
        actual_shipping_cost: 99,
        actual_tariff_cost: 5,
        estimated_shipping_cost: 0,
        estimated_tariff_cost: 0,
        currency: 'CNY',
        allocation_method: 'by_quantity',
        items: [],
      });
    mocks.serviceAllocateCosts.mockRejectedValueOnce(new Error('allocation failed'));

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_shipping_cost: 99, remark: 'after' }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(500);
    expect(mocks.repoUpdate).toHaveBeenNthCalledWith(1, 'po-1', {
      actual_shipping_cost: 99,
      remark: 'after',
    });
    expect(mocks.repoUpdate).toHaveBeenNthCalledWith(2, 'po-1', {
      actual_shipping_cost: 10,
      remark: 'before',
    });
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('rejects adding item when pre_order_id product/variant mismatch', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
      orderRows: [{ id: 'o-1', product_id: 'prod-x', variant_id: 'var-x', status: 'confirmed' }],
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            product_id: 'prod-1',
            variant_id: 'var-1',
            pre_order_id: 'o-1',
            quantity: 1,
            unit_cost: 10,
          }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
  });

  it('rejects adding item when pre_order_id is already linked to another active purchase order', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
      orderRows: [{ id: 'o-1', order_no: 'SO-1', product_id: 'prod-1', variant_id: 'var-1', status: 'confirmed' }],
    });
    mocks.repoFindActiveBindingsByPreOrderIds.mockResolvedValueOnce([
      { pre_order_id: 'o-1', po_id: 'po-9', po_no: 'PO-009', po_status: 'draft' },
    ]);

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            product_id: 'prod-1',
            variant_id: 'var-1',
            pre_order_id: 'o-1',
            quantity: 1,
            unit_cost: 10,
          }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('SO-1 已在采购单 PO-009 中');
    expect(mocks.repoAddItems).not.toHaveBeenCalled();
  });

  it('rejects adding item when pre_order_id quantity does not match the linked order', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
      orderRows: [{ id: 'o-1', order_no: 'SO-1', product_id: 'prod-1', variant_id: 'var-1', status: 'confirmed', quantity: 1 }],
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            product_id: 'prod-1',
            variant_id: 'var-1',
            pre_order_id: 'o-1',
            quantity: 10,
            unit_cost: 10,
          }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.repoAddItems).not.toHaveBeenCalled();
  });

  it('rejects adding item when unit_cost is negative', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            product_id: 'prod-1',
            variant_id: 'var-1',
            quantity: 1,
            unit_cost: -10,
          }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.repoAddItems).not.toHaveBeenCalled();
  });

  it('rejects updating item outside current po scope', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
    });
    mocks.repoUpdateItem.mockImplementation(async (poId, itemId) => !(poId === 'po-1' && itemId === 'item-foreign'));

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-foreign',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(404);
  });

  it('rejects purchase-order item patch when variant_id is supplied', async () => {
    const app = createApp();
    const db = createDb();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: 'var-2' }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.repoUpdateItem).not.toHaveBeenCalled();
  });

  it('re-validates quantity rules when patching a draft purchase-order item', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 5, pack_size: 1, order_step: 5 }],
      orderRows: [{ id: 'o-1', product_id: 'prod-1', variant_id: 'var-1', status: 'confirmed' }],
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 3 }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.repoUpdateItem).not.toHaveBeenCalled();
  });

  it('rejects purchase-order item patch when unit_cost is negative', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_cost: -5 }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.repoUpdateItem).not.toHaveBeenCalled();
  });

  it('rejects purchase-order item quantity patch when a linked pre_order quantity would diverge', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
      orderRows: [{ id: 'o-1', order_no: 'SO-1', product_id: 'prod-1', variant_id: 'var-1', status: 'confirmed', quantity: 5 }],
    });
    mocks.repoFindItemById.mockResolvedValueOnce({
      id: 'item-1',
      po_id: 'po-1',
      product_id: 'prod-1',
      variant_id: 'var-1',
      pre_order_id: 'o-1',
      quantity: 5,
      unit_cost: 5,
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 10 }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.repoUpdateItem).not.toHaveBeenCalled();
  });

  it('allows updating quantity when immutable linked records changed state after the line was created', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'archived', moq: 5, pack_size: 1, order_step: 5 }],
      orderRows: [{ id: 'o-1', product_id: 'prod-1', variant_id: 'var-1', status: 'cancelled' }],
    });
    mocks.repoFindItemById.mockResolvedValueOnce({
      id: 'item-1',
      po_id: 'po-1',
      product_id: 'prod-1',
      variant_id: 'var-1',
      pre_order_id: 'o-1',
      quantity: 5,
      unit_cost: 5,
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 10 }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.repoUpdateItem).toHaveBeenCalledWith('po-1', 'item-1', { quantity: 10 });
  });

  it('rejects deleting item outside current po scope', async () => {
    const app = createApp();
    const db = createDb();
    mocks.repoRemoveItem.mockImplementation(async (poId, itemId) => !(poId === 'po-1' && itemId === 'item-foreign'));

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-foreign',
      { method: 'DELETE' },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(404);
  });

  it('returns procurement-specific cascade message on status update', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();
    mocks.serviceUpdateStatus.mockResolvedValueOnce({
      success: true,
      cascadedOrders: 2,
      changedOrderIds: ['o-1', 'o-2'],
      changedOrderStatuses: [
        { orderId: 'o-1', procurementStatus: 'ordered' },
        { orderId: 'o-2', procurementStatus: 'ordered' },
      ],
      targetProcurementStatus: null,
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ordered' }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json?.data?.message || '').toContain('预订单采购状态');
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_status_changed',
        aggregate_id: 'po-1',
      }),
      expect.objectContaining({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: 'o-1',
        payload: expect.objectContaining({
          purchase_order_id: 'po-1',
          order_id: 'o-1',
          procurement_status_after: 'ordered',
          order_procurement_status_after: 'ordered',
          trigger: 'purchase_order_status_changed',
        }),
      }),
      expect.objectContaining({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: 'o-2',
      }),
    ]);
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'purchase_order.status.change', domain: 'purchase-orders' })
    );
  });

  it('enqueues purchase-order item create cache side effects through outbox', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
    });
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            product_id: 'prod-1',
            variant_id: 'var-1',
            quantity: 1,
            unit_cost: 10,
          }],
        }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_item_created',
        aggregate_id: 'po-1',
      }),
    ]);
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
  });

  it('enqueues purchase-order item update cache side effects through outbox', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
    });
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_item_updated',
        aggregate_id: 'po-1',
      }),
    ]);
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
  });

  it('enqueues purchase-order item delete cache side effects through outbox', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items/item-1',
      { method: 'DELETE' },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_item_deleted',
        aggregate_id: 'po-1',
      }),
    ]);
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
  });

  it('enqueues purchase-order allocation cache side effects through outbox', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();
    mocks.repoFindById.mockResolvedValue({ id: 'po-1', status: 'completed', items: [] });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/allocate',
      { method: 'POST' },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_cost_allocated',
        aggregate_id: 'po-1',
      }),
    ]);
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
  });

  it('rejects manual cost allocation before the purchase order reaches completed', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();
    mocks.repoFindById.mockResolvedValue({ id: 'po-1', status: 'arrived', items: [] });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/allocate',
      { method: 'POST' },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: '仅已结算采购单允许执行成本分摊',
    });
    expect(mocks.serviceAllocateCosts).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('creates receipts via domain service and returns 201', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'receipt-key-1',
        },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', received_qty: 2, note: 'ok' }],
        }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.domainRecordReceipts).toHaveBeenCalledWith('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 2, note: 'ok' }],
    }, {
      idempotencyKey: 'receipt-key-1',
    });
    expect(mocks.scheduleAuditEvent).not.toHaveBeenCalled();
    expect(mocks.scheduleCacheInvalidation).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('derives an idempotency key when the header is absent', async () => {
    const app = createApp();
    const db = createDb();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', received_qty: 1 }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.domainRecordReceipts).toHaveBeenCalledWith('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 1 }],
    }, {
      idempotencyKey: 'generated-idempotency-key',
    });
  });

  it('derives an idempotency key when the receipt header is blank', async () => {
    const app = createApp();
    const db = createDb();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': '   ',
        },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', received_qty: 1 }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.domainRecordReceipts).toHaveBeenCalledWith('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 1 }],
    }, {
      idempotencyKey: 'generated-idempotency-key',
    });
  });

  it('returns 400 when the domain rejects receipts because of invalid status', async () => {
    const app = createApp();
    const db = createDb();
    mocks.domainRecordReceipts.mockRejectedValueOnce(new BadRequestError('采购单状态不允许收货'));

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', received_qty: 1 }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json?.error).toBe('采购单状态不允许收货');
  });

  it('returns 400 when the domain rejects receipts because quantity exceeds remaining', async () => {
    const app = createApp();
    const db = createDb();
    mocks.domainRecordReceipts.mockRejectedValueOnce(new BadRequestError('超出剩余收货数量'));

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', received_qty: 5 }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json?.error).toBe('超出剩余收货数量');
  });

  it('reverses a receipt through POST /:id/receipts/:receiptId/reversal and returns 201', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts/receipt-1/reversal',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'reversal-key-1',
        },
        body: JSON.stringify({ reason: 'rollback' }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.reversalReverseReceipt).toHaveBeenCalledWith('po-1', 'receipt-1', {
      reason: 'rollback',
    }, {
      idempotencyKey: 'reversal-key-1',
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('passes Idempotency-Key through to the reversal service', async () => {
    const app = createApp();
    const db = createDb();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts/receipt-1/reversal',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'reversal-key-2',
        },
        body: JSON.stringify({ reason: 'rollback' }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.reversalReverseReceipt).toHaveBeenCalledWith(
      'po-1',
      'receipt-1',
      { reason: 'rollback' },
      { idempotencyKey: 'reversal-key-2' }
    );
  });

  it('derives an idempotency key when the reversal header is blank', async () => {
    const app = createApp();
    const db = createDb();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts/receipt-1/reversal',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': '   ',
        },
        body: JSON.stringify({ reason: 'rollback' }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.reversalReverseReceipt).toHaveBeenCalledWith(
      'po-1',
      'receipt-1',
      { reason: 'rollback' },
      { idempotencyKey: 'generated-idempotency-key' }
    );
  });

  it('returns 400 when the reversal command is rejected by domain invariants', async () => {
    const app = createApp();
    const db = createDb();
    mocks.reversalReverseReceipt.mockRejectedValueOnce(new BadRequestError('当前库存不足，无法执行收货冲销'));

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts/receipt-1/reversal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'rollback' }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json?.error).toBe('当前库存不足，无法执行收货冲销');
  });

  it('closes purchase-order shortages through POST /:id/shortage-closures and returns 201', async () => {
    const app = createApp();
    const db = createDb();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/shortage-closures',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'shortage-key-1',
        },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', close_qty: 2 }],
        }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.shortageCloseShortages).toHaveBeenCalledWith('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', close_qty: 2 }],
    }, {
      idempotencyKey: 'shortage-key-1',
    });
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'purchase_order_updated',
        aggregate_id: 'po-1',
        payload: expect.objectContaining({
          purchase_order_id: 'po-1',
          shortage_closed_count: 1,
        }),
      }),
      expect.objectContaining({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: 'o-1',
        payload: expect.objectContaining({
          purchase_order_id: 'po-1',
          order_id: 'o-1',
          order_line_id: 'line-1',
          order_line_display_status_after: 'partially_received',
          procurement_status_after: 'partially_arrived',
          order_procurement_status_after: 'partially_arrived',
          trigger: 'purchase_order_shortage_closed',
        }),
      }),
    ]);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'purchase_order.shortage.close',
      targetId: 'po-1',
    }));
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('derives an idempotency key for shortage closure when the header is absent', async () => {
    const app = createApp();
    const db = createDb();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/shortage-closures',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', close_qty: 1 }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.shortageCloseShortages).toHaveBeenCalledWith('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', close_qty: 1 }],
    }, {
      idempotencyKey: 'generated-idempotency-key',
    });
  });

  it('derives an idempotency key for shortage closure when the header is blank', async () => {
    const app = createApp();
    const db = createDb();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/shortage-closures',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': '   ',
        },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', close_qty: 1 }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.shortageCloseShortages).toHaveBeenCalledWith('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', close_qty: 1 }],
    }, {
      idempotencyKey: 'generated-idempotency-key',
    });
  });

  it('returns 400 when shortage closure is rejected by domain invariants', async () => {
    const app = createApp();
    const db = createDb();
    mocks.shortageCloseShortages.mockRejectedValueOnce(new BadRequestError('关闭数量超过剩余待收数量'));

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/shortage-closures',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ purchase_order_item_id: 'poi-1', close_qty: 5 }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json?.error).toBe('关闭数量超过剩余待收数量');
  });

  it('accepts add-items validation when variant lookups must be chunked', async () => {
    const variantBinds = [];
    const items = Array.from({ length: 105 }, (_, index) => ({
      product_id: `prod-${index + 1}`,
      variant_id: `var-${index + 1}`,
      quantity: 1,
      unit_cost: 10,
    }));
    const db = {
      prepare: vi.fn((sql) => ({
        bind: (...args) => {
          if (sql.includes('FROM product_variants')) {
            variantBinds.push(args);
          }
          return {
            all: vi.fn(async () => {
              if (sql.includes('FROM product_variants')) {
                return {
                  results: args.map((variantId) => {
                    const suffix = String(variantId).replace('var-', '');
                    return {
                      id: variantId,
                      product_id: `prod-${suffix}`,
                      status: 'active',
                      moq: 1,
                      pack_size: 1,
                      order_step: 1,
                    };
                  }),
                };
              }
              if (sql.includes('FROM orders')) {
                return { results: [] };
              }
              return { results: [] };
            }),
            first: vi.fn(async () => null),
            run: vi.fn(async () => ({ meta: { changes: 1 } })),
          };
        },
      })),
    };
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(variantBinds.length).toBeGreaterThan(1);
    expect(Math.max(...variantBinds.map((args) => args.length))).toBeLessThanOrEqual(100);
    expect(mocks.repoAddItems).toHaveBeenCalledWith('po-1', items);
  });

  it('accepts add-items validation when linked preorder lookups must be chunked', async () => {
    const orderBinds = [];
    const items = Array.from({ length: 105 }, (_, index) => ({
      product_id: `prod-${index + 1}`,
      variant_id: `var-${index + 1}`,
      pre_order_id: `order-${index + 1}`,
      quantity: 1,
      unit_cost: 10,
    }));
    const db = {
      prepare: vi.fn((sql) => ({
        bind: (...args) => {
          if (sql.includes('FROM orders')) {
            orderBinds.push(args);
          }
          return {
            all: vi.fn(async () => {
              if (sql.includes('FROM product_variants')) {
                return {
                  results: items.map((item) => ({
                    id: item.variant_id,
                    product_id: item.product_id,
                    status: 'active',
                    moq: 1,
                    pack_size: 1,
                    order_step: 1,
                  })),
                };
              }
              if (sql.includes('FROM orders')) {
                return {
                  results: args.map((orderId) => {
                    const suffix = String(orderId).replace('order-', '');
                    return {
                      id: orderId,
                      status: 'confirmed',
                      product_id: `prod-${suffix}`,
                      variant_id: `var-${suffix}`,
                    };
                  }),
                };
              }
              return { results: [] };
            }),
            first: vi.fn(async () => null),
            run: vi.fn(async () => ({ meta: { changes: 1 } })),
          };
        },
      })),
    };
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/items',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(orderBinds.length).toBeGreaterThan(1);
    expect(Math.max(...orderBinds.map((args) => args.length))).toBeLessThanOrEqual(100);
    expect(mocks.repoAddItems).toHaveBeenCalledWith('po-1', items);
  });

  it('cleans up the created draft when create route item insertion fails', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
    });
    mocks.repoAddItems.mockRejectedValueOnce(new Error('insert items failed'));

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            product_id: 'prod-1',
            variant_id: 'var-1',
            quantity: 1,
            unit_cost: 10,
          }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(500);
    expect(mocks.repoDeleteIfEmptyDraft).toHaveBeenCalledWith('po-1');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('rejects invalid create-route items before creating a draft purchase order', async () => {
    const app = createApp();
    const db = createDb({
      variantRows: [{ id: 'var-1', product_id: 'prod-1', status: 'active', moq: 1, pack_size: 1, order_step: 1 }],
    });

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            product_id: 'prod-1',
            variant_id: 'var-1',
            quantity: 1,
            unit_cost: -10,
          }],
        }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.repoCreate).not.toHaveBeenCalled();
    expect(mocks.repoDeleteIfEmptyDraft).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
