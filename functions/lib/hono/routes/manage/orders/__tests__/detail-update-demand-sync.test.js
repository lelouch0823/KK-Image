import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  orderFindById: vi.fn(),
  validateProductVariantBinding: vi.fn(),
  processOrderUpdate: vi.fn(),
  demandSyncOrderTransition: vi.fn(async () => {}),
  scheduleAuditEvent: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.orderFindById,
  })),
}));

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: vi.fn(() => ({
    findById: vi.fn(),
  })),
}));

vi.mock('../../../../../../api/utils/validation.js', () => ({
  validateProductVariantBinding: mocks.validateProductVariantBinding,
}));

vi.mock('../../../../../../api/utils/order-state-machine.js', () => ({
  canTransitionOrderStatus: vi.fn(() => true),
}));

vi.mock('../authz-helpers.js', () => ({
  assertAdminFull: vi.fn(async () => {}),
  assertForceStatusTransitionAllowed: vi.fn(async () => {}),
}));

vi.mock('../error-helpers.js', () => ({
  isInsufficientStockError: vi.fn(() => false),
  isInvalidStatusTransitionError: vi.fn(() => false),
}));

vi.mock('../../../../../../services/DemandService.js', () => ({
  DemandService: vi.fn(() => ({
    syncOrderTransition: mocks.demandSyncOrderTransition,
  })),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

vi.mock('../../../../../../api/utils/order-utils.js', () => ({
  processOrderUpdate: mocks.processOrderUpdate,
}));

import detailRoutesApp from '../detail.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', detailRoutesApp);
  return app;
}

describe('manage order detail update demand sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderFindById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 1,
      variantId: 'v-old',
      productId: 'p-1',
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
    });
    mocks.validateProductVariantBinding.mockResolvedValue({
      product: null,
      variant: null,
      normalizedProductId: null,
      normalizedVariantId: null,
    });
    mocks.processOrderUpdate.mockResolvedValue({
      success: true,
      hasChanges: true,
      outboxEvents: [
        {
          event_type: 'order_updated_by_admin',
          aggregate_type: 'order',
          aggregate_id: 'o-1',
          payload: { order_id: 'o-1' },
        },
      ],
    });
  });

  it('passes null variantId to demand sync when admin unbinds a product', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
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
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
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

  it('passes null variantId to demand sync when a single bound order line is rewritten as manual', async () => {
    mocks.orderFindById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 1,
      variantId: 'v-old',
      productId: 'p-1',
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
      lines: [
        {
          id: 'line-1',
          productId: 'p-1',
          variantId: 'v-old',
          quantity: 1,
        },
      ],
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'rewrite bound line as manual',
          updates: {
            lines: [{ productName: 'Manual A', quantity: 1, sku: 'SKU-MANUAL' }],
          },
        }),
      },
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
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

  it('rebalances demand when admin changes quantity on a confirmed product', async () => {
    mocks.orderFindById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'confirmed',
      quantity: 1,
      variantId: 'v-old',
      productId: 'p-1',
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'quantity changed',
          updates: { quantity: 3 },
        }),
      },
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.demandSyncOrderTransition).toHaveBeenCalledTimes(2);
    expect(mocks.demandSyncOrderTransition).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderId: 'o-1',
        fromStatus: 'confirmed',
        toStatus: 'void',
        quantity: 1,
        variantId: 'v-old',
      })
    );
    expect(mocks.demandSyncOrderTransition).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderId: 'o-1',
        fromStatus: null,
        toStatus: 'confirmed',
        quantity: 3,
        variantId: 'v-old',
      })
    );
  });

  it('uses persisted order line ids when confirming a rewritten same-variant multi-line order', async () => {
    mocks.orderFindById
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'pending',
        quantity: 2,
        variantId: null,
        productId: null,
        salespersonId: 'sp-1',
        currentData: { name: 'A' },
        lines: [
          {
            id: 'line-old-1',
            productId: 'p-1',
            variantId: 'v-1',
            quantity: 1,
          },
          {
            id: 'line-old-2',
            productId: 'p-1',
            variantId: 'v-1',
            quantity: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'confirmed',
        quantity: 3,
        variantId: null,
        productId: null,
        salespersonId: 'sp-1',
        currentData: { name: 'A' },
        lines: [
          {
            id: 'line-new-1',
            productId: 'p-1',
            variantId: 'v-1',
            quantity: 1,
          },
          {
            id: 'line-new-2',
            productId: 'p-1',
            variantId: 'v-1',
            quantity: 2,
          },
        ],
      });
    mocks.validateProductVariantBinding.mockImplementation(async (_db, productId, variantId) => ({
      product: null,
      variant: null,
      normalizedProductId: productId,
      normalizedVariantId: variantId,
    }));

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'confirm same variant multiline rewrite',
          updates: {
            status: 'confirmed',
            lines: [
              { name: 'Line A', quantity: 1, productId: 'p-1', variantId: 'v-1' },
              { name: 'Line B', quantity: 2, productId: 'p-1', variantId: 'v-1' },
            ],
          },
        }),
      },
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.demandSyncOrderTransition).toHaveBeenCalledTimes(2);
    expect(mocks.demandSyncOrderTransition).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderId: 'o-1',
        fromStatus: null,
        toStatus: 'confirmed',
        orderLineId: 'line-new-1',
        productId: 'p-1',
        variantId: 'v-1',
        quantity: 1,
      })
    );
    expect(mocks.demandSyncOrderTransition).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderId: 'o-1',
        fromStatus: null,
        toStatus: 'confirmed',
        orderLineId: 'line-new-2',
        productId: 'p-1',
        variantId: 'v-1',
        quantity: 2,
      })
    );
  });

  it('rejects binding edits when admin changes a confirmed order', async () => {
    mocks.orderFindById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'confirmed',
      quantity: 1,
      variantId: 'v-old',
      productId: 'p-1',
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'unbind confirmed',
          productId: null,
          variantId: null,
          updates: { remark: 'manual order now' },
        }),
      },
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.processOrderUpdate).not.toHaveBeenCalled();
    expect(mocks.demandSyncOrderTransition).not.toHaveBeenCalled();
  });

  it('rejects quantity edits when admin changes a shipping order', async () => {
    mocks.orderFindById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'shipping',
      quantity: 1,
      variantId: 'v-old',
      productId: 'p-1',
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'quantity changed in shipping',
          updates: { quantity: 3 },
        }),
      },
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.processOrderUpdate).not.toHaveBeenCalled();
    expect(mocks.demandSyncOrderTransition).not.toHaveBeenCalled();
  });

  it('rejects multi-line updates when any line has an invalid product binding', async () => {
    mocks.orderFindById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 2,
      variantId: null,
      productId: null,
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
      lines: [],
    });
    mocks.validateProductVariantBinding.mockImplementation(async (_db, productId, variantId) => {
      if (productId === 'p-bad' && variantId === 'v-bad') {
        throw new Error('variantId does not belong to productId');
      }
      return {
        product: null,
        variant: null,
        normalizedProductId: productId,
        normalizedVariantId: variantId,
      };
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'reshape lines with invalid binding',
          updates: {
            lines: [
              { name: 'Line A', quantity: 1, productId: 'p-1', variantId: 'v-1' },
              { name: 'Line B', quantity: 1, productId: 'p-bad', variantId: 'v-bad' },
            ],
          },
        }),
      },
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(500);
    expect(mocks.processOrderUpdate).not.toHaveBeenCalled();
    expect(mocks.demandSyncOrderTransition).not.toHaveBeenCalled();
  });

  it('hydrates binding snapshot fields from variant options during admin rebind', async () => {
    mocks.orderFindById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 1,
      variantId: null,
      productId: null,
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
    });
    mocks.validateProductVariantBinding.mockResolvedValue({
      product: {
        id: 'p-1',
        status: 'active',
        name: 'Hydrated Tee',
        brand: 'ACME',
        category: 'Outerwear',
        series: 'S1',
        dimension_map: {
          'dim-color': 'Color',
          'dim-material': 'Material',
          'dim-size': 'Size',
        },
      },
      variant: {
        id: 'v-1',
        sku: 'SKU-RED-M',
        options_values: {
          'dim-color': 'Red',
          'dim-material': 'Cotton',
          'dim-size': 'M',
        },
      },
      normalizedProductId: 'p-1',
      normalizedVariantId: 'v-1',
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'bind hydrated variant',
          productId: 'p-1',
          variantId: 'v-1',
          updates: { remark: 'manual order now' },
        }),
      },
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: expect.objectContaining({
          category: 'Outerwear',
          sku: 'SKU-RED-M',
          color: 'Red',
          material: 'Cotton',
          size: 'Size: M',
        }),
      })
    );
  });

  it('forwards salesperson reassignment through admin order update', async () => {
    mocks.orderFindById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'pending',
      quantity: 1,
      variantId: null,
      productId: null,
      salespersonId: 'sp-1',
      currentData: { name: 'A' },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/o-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'reassign salesperson',
          updates: { salespersonId: 'sp-2' },
        }),
      },
      { DB: { prepare: vi.fn() }, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        salespersonId: 'sp-2',
        salespersonIdUpdate: 'sp-2',
      })
    );
  });
});
