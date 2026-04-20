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
  processOrderUpdate: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  productVariantFindByIdAndProductId: vi.fn(),
  productSearch: vi.fn(),
  productFindById: vi.fn(),
  variantFindByProductId: vi.fn(),
  dimensionListByProduct: vi.fn(),
  dimensionGetMap: vi.fn(),
  variantImageListByVariant: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
  demandSyncOrderTransition: vi.fn(async () => {}),
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

vi.mock('../../../../../repositories/order/history-queries.js', () => ({
  listOrderShipmentHistory: vi.fn(async () => []),
  listOrderReturnHistory: vi.fn(async () => []),
}));

vi.mock('../../../../../api/utils/order-utils.js', () => ({
  processOrderUpdate: mocks.processOrderUpdate,
}));

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../services/DemandService.js', () => ({
  DemandService: vi.fn(() => ({
    syncOrderTransition: mocks.demandSyncOrderTransition,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
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

const createDbMock = () => ({
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      all: vi.fn(async () => ({ results: [] })),
      first: vi.fn(async () => null),
    })),
  })),
});

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
    mocks.processOrderUpdate.mockResolvedValue({
      success: true,
      hasChanges: true,
      outboxEvents: [
        {
          event_type: 'order_updated_by_sales',
          aggregate_type: 'order',
          aggregate_id: 'o-1',
          payload: {
            order_id: 'o-1',
            order_no: 'SO-1',
            salesperson_id: 'sp-1',
            actor_name: 'Alice',
          },
        },
      ],
    });
    mocks.demandSyncOrderTransition.mockResolvedValue(undefined);
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

  it('normalizes legacy delivered status filter to fulfilled for salesperson lists', async () => {
    mocks.orderListBySalesperson.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
    const app = createOrdersTestApp();

    const res = await app.request(
      'http://localhost/api/sales/token-1/orders?status=delivered',
      {},
      { DB: createDbMock() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.orderListBySalesperson).toHaveBeenCalledWith(
      'sp-1',
      expect.objectContaining({ status: 'fulfilled' })
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

  it('filters sales product list by in-stock availability', async () => {
    mocks.productSearch.mockResolvedValue({
      items: [
        { id: 'p-1', name: 'In Stock Tee', brand: 'ACME', series: 'S1', images: [] },
      ],
      total: 1,
      page: 1,
      limit: 12,
    });

    const app = createProductsTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/products?search=tee&page=1&limit=12',
      {},
      { DB: createDbMock() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.productSearch).toHaveBeenCalledWith({
      search: 'tee',
      status: 'active',
      hasStock: 'in_stock',
      page: 1,
      limit: 12,
    }, {
      includeFilters: false,
    });
  });

  it('rejects order creation when bound variant is out of stock under sales policy', async () => {
    mocks.productVariantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'active',
      available_quantity: 0,
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
    const payload = await res.json();
    expect(payload.error).toContain('variant must be in stock');
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('hydrates binding snapshot fields from variant options during salesperson create', async () => {
    mocks.productVariantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'active',
      sku: 'SKU-RED-M',
      available_quantity: 8,
      options_values: {
        'dim-color': 'Red',
        'dim-material': 'Cotton',
        'dim-size': 'M',
      },
    });
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      status: 'active',
      name: 'Hydrated Tee',
      brand: 'ACME',
      category: 'Outerwear',
      series: 'S1',
      images: '[]',
      dimension_map: {
        'dim-color': 'Color',
        'dim-material': 'Material',
        'dim-size': 'Size',
      },
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Placeholder',
          quantity: 1,
          productId: 'p-1',
          variantId: 'v-1',
          fileIds: [],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'Outerwear',
          sku: 'SKU-RED-M',
          color: 'Red',
          material: 'Cotton',
          size: 'Size: M',
        }),
      })
    );
  });

  it('rejects salesperson create when request payload includes unexpected lines', async () => {
    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Header Product',
          quantity: 1,
          sku: 'SKU-HEADER',
          fileIds: [],
          lines: [
            { name: 'Line A', quantity: 2, sku: 'SKU-A' },
            { name: 'Line B', quantity: 3, sku: 'SKU-B' },
          ],
        }),
      },
      { DB: createDbMock() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toBeTruthy();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.demandSyncOrderTransition).not.toHaveBeenCalled();
  });

  it('hydrates binding snapshot fields from repository dimension_map when product payload omits it', async () => {
    mocks.productVariantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'active',
      sku: 'SKU-BLUE-L',
      available_quantity: 5,
      options_values: {
        'dim-color': 'Blue',
        'dim-material': 'Linen',
        'dim-size': 'L',
      },
    });
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      status: 'active',
      name: 'Repository Hydrated Tee',
      brand: 'ACME',
      category: 'Tops',
      series: 'S2',
      images: '[]',
    });
    mocks.dimensionGetMap.mockResolvedValue({
      'dim-color': 'Color',
      'dim-material': 'Material',
      'dim-size': 'Size',
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Placeholder',
          quantity: 1,
          productId: 'p-1',
          variantId: 'v-1',
          fileIds: [],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.dimensionGetMap).toHaveBeenCalledWith('p-1');
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'Tops',
          sku: 'SKU-BLUE-L',
          color: 'Blue',
          material: 'Linen',
          size: 'Size: L',
        }),
      })
    );
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

  it('filters archived dimensions and values from sales product detail', async () => {
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      status: 'active',
      images: '[]',
    });
    mocks.variantFindByProductId.mockResolvedValue([
      { id: 'v-1', product_id: 'p-1', status: 'active', options_values: { 'dim-color': 'Red' } },
    ]);
    mocks.dimensionListByProduct.mockResolvedValue([
      {
        id: 'dim-color',
        name: 'Color',
        status: 'active',
        values: [
          { id: 'val-red', value: 'Red', status: 'active' },
          { id: 'val-blue', value: 'Blue', status: 'archived' },
        ],
      },
      {
        id: 'dim-size',
        name: 'Size',
        status: 'archived',
        values: [{ id: 'val-m', value: 'M', status: 'active' }],
      },
    ]);
    mocks.dimensionGetMap.mockResolvedValue({
      'dim-color': 'Color',
      'dim-size': 'Size',
    });

    const app = createProductsTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/products/p-1',
      {},
      { DB: createDbMock() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.dimensions).toEqual([
      {
        id: 'dim-color',
        name: 'Color',
        status: 'active',
        values: [{ id: 'val-red', value: 'Red', status: 'active' }],
      },
    ]);
    expect(payload.data.dimension_map).toEqual({ 'dim-color': 'Color' });
  });

  it('filters out-of-stock variants from sales product detail to match sales order policy', async () => {
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      status: 'active',
      images: '[]',
    });
    mocks.variantFindByProductId.mockResolvedValue([
      { id: 'v-in', product_id: 'p-1', status: 'active', available_quantity: 3, stock_quantity: 3, options_values: { 'dim-color': 'Red' } },
      { id: 'v-out', product_id: 'p-1', status: 'active', available_quantity: 0, stock_quantity: 0, options_values: { 'dim-color': 'Blue' } },
      { id: 'v-archived', product_id: 'p-1', status: 'archived', available_quantity: 8, stock_quantity: 8, options_values: { 'dim-color': 'Green' } },
    ]);
    mocks.dimensionListByProduct.mockResolvedValue([]);
    mocks.variantImageListByVariant.mockResolvedValue([]);

    const app = createProductsTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/products/p-1',
      {},
      { DB: createDbMock() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.variants).toHaveLength(1);
    expect(payload.data.variants[0]).toEqual(
      expect.objectContaining({
        id: 'v-in',
        available_quantity: 3,
      })
    );
  });

  it('enqueues sales read cache invalidation through outbox after GET /:id', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      currentData: {},
    });

    const waitUntil = vi.fn();
    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1',
      { method: 'GET' },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.orderMarkAsRead).toHaveBeenCalledWith('o-1', 'sales');
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.publish.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        event_type: 'order_read_by_sales',
        aggregate_id: 'o-1',
        payload: expect.objectContaining({
          order_id: 'o-1',
          salesperson_id: 'sp-1',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.invalidateCache).not.toHaveBeenCalled();
  });

  it('enqueues sales read cache invalidation through outbox after PATCH /:id/read', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      currentData: {},
    });

    const waitUntil = vi.fn();
    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1/read',
      { method: 'PATCH' },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.orderMarkAsRead).toHaveBeenCalledWith('o-1', 'sales');
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.publish.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        event_type: 'order_read_by_sales',
        aggregate_id: 'o-1',
        payload: expect.objectContaining({
          order_id: 'o-1',
          salesperson_id: 'sp-1',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.invalidateCache).not.toHaveBeenCalled();
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
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_comment_created_by_sales',
        aggregate_id: 'o-1',
        payload: expect.objectContaining({
          order_id: 'o-1',
          order_no: 'SO-1',
          actor_name: 'Alice',
          comment: 'need review',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'sales.order.comment.create', domain: 'sales-orders' })
    );
  });

  it('enqueues order-created side effects through outbox for salesperson create', async () => {
    const waitUntil = vi.fn();
    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Shoes',
          quantity: 1,
          fileIds: [],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_created_by_sales',
        aggregate_type: 'order',
        payload: expect.objectContaining({
          salesperson_id: 'sp-1',
          actor_name: 'Alice',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });

  it('enqueues deferred order-update side effects through outbox for salesperson patch', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 1,
      variantId: 'v-1',
      productId: 'p-1',
      currentData: { name: 'A' },
    });

    const waitUntil = vi.fn();
    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { remark: 'next' }, reason: 'customer changed' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      deferNotifications: true,
    }));
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_updated_by_sales',
        aggregate_id: 'o-1',
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });

  it('preserves existing bound snapshots during ordinary salesperson edits', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 1,
      variantId: 'v-1',
      productId: 'p-1',
      currentData: {
        name: 'Frozen Name',
        brand: 'Frozen Brand',
        series: 'Frozen Series',
        sku: 'FROZEN-SKU',
        size: 'Size: M',
        color: 'Black',
        material: 'Leather',
      },
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'customer changed note',
          updates: {
            remark: 'next',
            name: 'Live Rename',
            brand: 'Live Brand',
            series: 'Live Series',
            sku: 'LIVE-SKU',
            size: 'Size: XL',
            color: 'White',
            material: 'Metal',
          },
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.productFindById).not.toHaveBeenCalled();
    expect(mocks.productVariantFindByIdAndProductId).not.toHaveBeenCalled();
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      updates: { remark: 'next' },
    }));
  });

  it('rejects salesperson patch when rebinding to an out-of-stock variant', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 1,
      variantId: 'v-old',
      productId: 'p-1',
      currentData: { name: 'A' },
    });
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      status: 'active',
      images: '[]',
    });
    mocks.productVariantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'active',
      available_quantity: 0,
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'rebinding',
          productId: 'p-1',
          variantId: 'v-1',
          updates: { remark: 'next' },
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toContain('variant must be in stock');
    expect(mocks.processOrderUpdate).not.toHaveBeenCalled();
  });

  it('passes null variantId to demand sync when salesperson unbinds a product', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 1,
      variantId: 'v-old',
      productId: 'p-1',
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
    });

    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'unbind',
          productId: null,
          variantId: null,
          updates: { remark: 'manual order now' },
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.demandSyncOrderTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'o-1',
        variantId: null,
      })
    );
  });

  it('enqueues order status change through outbox for salesperson void', async () => {
    mocks.orderFindByIdAndSalesperson.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 2,
      variantId: 'v-1',
      currentData: {},
    });

    const waitUntil = vi.fn();
    const app = createOrdersTestApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders/o-1',
      { method: 'DELETE' },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_status_changed_by_sales',
        aggregate_id: 'o-1',
        payload: expect.objectContaining({
          order_id: 'o-1',
          order_no: 'SO-1',
          salesperson_id: 'sp-1',
          status: 'void',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });
});
