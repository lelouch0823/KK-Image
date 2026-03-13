import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoFindById: vi.fn(),
  repoAddItems: vi.fn(),
  repoUpdateItem: vi.fn(),
  repoRemoveItem: vi.fn(),
  serviceUpdateStatus: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../repositories/PurchaseOrderRepository.js', () => ({
  PurchaseOrderRepository: vi.fn(() => ({
    findById: mocks.repoFindById,
    addItems: mocks.repoAddItems,
    updateItem: mocks.repoUpdateItem,
    removeItem: mocks.repoRemoveItem,
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })),
    getStats: vi.fn(async () => ({})),
  })),
}));

vi.mock('../../../../../services/PurchaseOrderService.js', () => ({
  PurchaseOrderService: vi.fn(() => ({
    updateStatus: mocks.serviceUpdateStatus,
    getSuggestions: vi.fn(async () => []),
    createFromOrders: vi.fn(),
    allocateCosts: vi.fn(),
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
  scheduleCacheInvalidation: vi.fn(),
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import purchaseOrdersApp from '../purchase-orders.js';

function createDb({ variantRows = [], orderRows = [] } = {}) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn(() => ({
        all: vi.fn(async () => {
          if (sql.includes('FROM product_variants')) return { results: variantRows };
          if (sql.includes('FROM orders')) return { results: orderRows };
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
    mocks.repoFindById.mockResolvedValue({ id: 'po-1', status: 'draft', items: [] });
    mocks.repoAddItems.mockResolvedValue(['poi-1']);
    mocks.repoUpdateItem.mockResolvedValue(true);
    mocks.repoRemoveItem.mockResolvedValue(true);
    mocks.serviceUpdateStatus.mockResolvedValue({ success: true, cascadedOrders: 2 });
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

  it('rejects updating item outside current po scope', async () => {
    const app = createApp();
    const db = createDb();
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

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ordered' }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json?.data?.message || '').toContain('预订单采购状态');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'purchase_order.status.change', domain: 'purchase-orders' })
    );
  });
});
