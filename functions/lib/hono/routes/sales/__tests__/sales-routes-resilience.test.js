import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  orderListBySalesperson: vi.fn(),
  orderCreate: vi.fn(),
  orderFindByIdAndSalesperson: vi.fn(),
  orderGetFiles: vi.fn(),
  orderMarkAsRead: vi.fn(),
  orderUpdateStatus: vi.fn(),
  orderSetUnread: vi.fn(),
  orderTimelineGetTimeline: vi.fn(),
  orderTimelineAddTimelineEntry: vi.fn(),
  createOrderNotification: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  productVariantFindByIdAndProductId: vi.fn(),
  productSearch: vi.fn(),
  productFindById: vi.fn(),
  variantFindByProductId: vi.fn(),
  dimensionListByProduct: vi.fn(),
  dimensionGetMap: vi.fn(),
  variantImageListByVariant: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    listBySalesperson: mocks.orderListBySalesperson,
    create: mocks.orderCreate,
    findByIdAndSalesperson: mocks.orderFindByIdAndSalesperson,
    getFiles: mocks.orderGetFiles,
    markAsRead: mocks.orderMarkAsRead,
    updateStatus: mocks.orderUpdateStatus,
    setUnread: mocks.orderSetUnread,
  })),
}));

vi.mock('../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: vi.fn(() => ({
    findByIdAndProductId: mocks.productVariantFindByIdAndProductId,
    findByProductId: mocks.variantFindByProductId,
  })),
}));

vi.mock('../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: vi.fn(() => ({
    search: mocks.productSearch,
    findById: mocks.productFindById,
  })),
}));

vi.mock('../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: vi.fn(() => ({
    listByProduct: mocks.dimensionListByProduct,
    getDimensionMap: mocks.dimensionGetMap,
  })),
}));

vi.mock('../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: vi.fn(() => ({
    listByVariant: mocks.variantImageListByVariant,
  })),
}));

vi.mock('../../../../../repositories/OrderTimelineRepository.js', () => ({
  OrderTimelineRepository: vi.fn(() => ({
    getTimeline: mocks.orderTimelineGetTimeline,
    addTimelineEntry: mocks.orderTimelineAddTimelineEntry,
  })),
}));

vi.mock('../../../../../api/utils/order-utils.js', () => ({
  createOrderNotification: mocks.createOrderNotification,
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import ordersApp from '../orders.js';
import productsApp from '../products.js';

const createOrdersTestApp = () => {
  const app = new Hono();
  app.use('/api/sales/:token/orders/*', async (c, next) => {
    c.set('salesperson', { id: 'sp-1', name: 'Alice' });
    await next();
  });
  app.route('/api/sales/:token/orders', ordersApp);
  return app;
};

const createProductsTestApp = () => {
  const app = new Hono();
  app.route('/api/sales/:token/products', productsApp);
  return app;
};

describe('sales routes resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productSearch.mockResolvedValue({ items: [], total: 0 });
    mocks.productFindById.mockResolvedValue({ id: 'p-1', status: 'active', images: '[]' });
    mocks.variantFindByProductId.mockResolvedValue([]);
    mocks.dimensionListByProduct.mockResolvedValue([]);
    mocks.dimensionGetMap.mockResolvedValue({});
    mocks.variantImageListByVariant.mockResolvedValue([]);
    mocks.orderGetFiles.mockResolvedValue([]);
    mocks.orderTimelineGetTimeline.mockResolvedValue([]);
    mocks.orderMarkAsRead.mockResolvedValue(true);
    mocks.orderSetUnread.mockResolvedValue(true);
    mocks.createOrderNotification.mockResolvedValue(undefined);
  });

  it('returns consistent error payload for variant validation failure', async () => {
    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Shoes',
          productId: 'p-1',
          fileIds: [],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.any(String),
        code: 'BAD_REQUEST',
      })
    );
  });

  it('rejects order creation when bound product is archived', async () => {
    mocks.productVariantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'active',
    });
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      status: 'archived',
      images: '[]',
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Shoes',
          productId: 'p-1',
          variantId: 'v-1',
          fileIds: [],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('rejects order creation when bound variant is archived', async () => {
    mocks.productVariantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'archived',
    });
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      status: 'active',
      images: '[]',
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Shoes',
          productId: 'p-1',
          variantId: 'v-1',
          fileIds: [],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('sales products endpoints return stable schema under empty/error', async () => {
    const app = createProductsTestApp();

    const emptyRes = await app.request(
      'http://localhost/api/sales/token-1/products?page=1&limit=12',
      {},
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(emptyRes.status).toBe(200);
    const emptyPayload = await emptyRes.json();
    expect(emptyPayload).toEqual(
      expect.objectContaining({
        success: true,
        data: [],
        meta: expect.objectContaining({ total: 0, page: 1, limit: 12 }),
      })
    );

    mocks.productSearch.mockRejectedValueOnce(new Error('db down'));

    const errRes = await app.request(
      'http://localhost/api/sales/token-1/products?page=1&limit=12',
      {},
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(errRes.status).toBe(500);
    const errPayload = await errRes.json();
    expect(errPayload).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.any(String),
        code: 'INTERNAL_ERROR',
      })
    );
  });

  it('invalidates sales order list cache after GET /:id marks order as read', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      currentData: {},
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1',
      { method: 'GET' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.orderMarkAsRead).toHaveBeenCalledWith('o-1', 'sales');

    const invalidatedUrls = mocks.invalidateCache.mock.calls
      .map(([urls]) => (Array.isArray(urls) ? urls : [urls]))
      .flat();
    expect(invalidatedUrls).toContain('http://localhost/api/sales/token-1/orders?limit=20&page=1');
  });

  it('invalidates sales order list cache after PATCH /:id/read', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      currentData: {},
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1/read',
      { method: 'PATCH' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.orderMarkAsRead).toHaveBeenCalledWith('o-1', 'sales');

    const invalidatedUrls = mocks.invalidateCache.mock.calls
      .map(([urls]) => (Array.isArray(urls) ? urls : [urls]))
      .flat();
    expect(invalidatedUrls).toContain('http://localhost/api/sales/token-1/orders?limit=20&page=1');
  });

  it('rejects PATCH /:id/read when order does not belong to current salesperson', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue(null);

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/other-order/read',
      { method: 'PATCH' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(404);
    expect(mocks.orderMarkAsRead).not.toHaveBeenCalled();
  });

  it('invalidates manage order list cache after salesperson comment sets unread for admin', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      currentData: {},
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1/comment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'need review' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.orderSetUnread).toHaveBeenCalledWith('o-1', 'sales');

    const invalidatedUrls = mocks.invalidateCache.mock.calls
      .map(([urls]) => (Array.isArray(urls) ? urls : [urls]))
      .flat();
    expect(invalidatedUrls).toContain('http://localhost/api/manage/orders');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'sales.order.comment.create', domain: 'sales-orders' })
    );
  });
});
