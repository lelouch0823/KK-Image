import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordAuditEvent: vi.fn(async () => ({})),
  invalidateCache: vi.fn(async () => {}),
  getSalespersonAccessTokens: vi.fn(async () => []),
  getAllSalespersonAccessTokens: vi.fn(async () => []),
  refreshSystemStats: vi.fn(async () => ({})),
  refreshVariantSnapshotByOrderId: vi.fn(async () => []),
  refreshVariantSnapshotAll: vi.fn(async () => []),
}));

vi.mock('../../lib/hono/_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../lib/hono/_shared/audit-helpers.js');
  return {
    ...actual,
    recordAuditEvent: mocks.recordAuditEvent,
  };
});

vi.mock('../../lib/hono/middleware/cache.js', async () => {
  const actual = await vi.importActual('../../lib/hono/middleware/cache.js');
  return {
    ...actual,
    invalidateCache: mocks.invalidateCache,
  };
});

vi.mock('../../lib/hono/_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../lib/hono/_shared/route-helpers.js');
  return {
    ...actual,
    getSalespersonAccessTokens: mocks.getSalespersonAccessTokens,
    getAllSalespersonAccessTokens: mocks.getAllSalespersonAccessTokens,
  };
});

vi.mock('../SystemStatsProjectionRefreshService.js', () => ({
  STATS_PROJECTION_SCOPES: {
    MANAGE_STATS: 'manage.stats',
    DASHBOARD_OVERVIEW: 'manage.dashboard.overview',
  },
  SystemStatsProjectionRefreshService: vi.fn(() => ({
    refresh: mocks.refreshSystemStats,
  })),
}));

vi.mock('../VariantSnapshotProjectionRefreshService.js', () => ({
  VariantSnapshotProjectionRefreshService: vi.fn(() => ({
    refreshByOrderId: mocks.refreshVariantSnapshotByOrderId,
    refreshAll: mocks.refreshVariantSnapshotAll,
  })),
}));

import { DOMAIN_OUTBOX_CONSUMERS } from '../DomainOutboxConsumers.js';

describe('DomainOutboxConsumers audit and cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSalespersonAccessTokens.mockResolvedValue([]);
    mocks.getAllSalespersonAccessTokens.mockResolvedValue([]);
  });

  it('writes audit logs from purchase receipt domain events', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.audit({
      db: { prepare: vi.fn() },
      event: {
        id: 'evt-1',
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-1',
        correlation_id: 'cmd-1',
        payload_json: JSON.stringify({
          purchase_order_id: 'po-1',
          purchase_order_item_id: 'poi-1',
          order_id: 'o-1',
          receipt_id: 'receipt-1',
          received_qty: 3,
        }),
      },
    });

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        domain: 'purchase-orders',
        action: 'purchase_order.receipt.create',
        targetType: 'purchase_order',
        targetId: 'po-1',
        summary: expect.stringContaining('po-1'),
        metadata: expect.objectContaining({
          eventId: 'evt-1',
          purchaseOrderItemId: 'poi-1',
          receiptId: 'receipt-1',
          receivedQty: 3,
        }),
      })
    );
  });

  it('writes reversal audit logs with reverse action and reversal metadata', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.audit({
      db: { prepare: vi.fn() },
      event: {
        id: 'evt-2',
        event_type: 'purchase_receipt_reversed',
        aggregate_type: 'purchase_receipt_reversal',
        aggregate_id: 'reversal-1',
        correlation_id: 'cmd-2',
        payload_json: JSON.stringify({
          purchase_order_id: 'po-2',
          purchase_order_item_id: 'poi-2',
          original_receipt_id: 'receipt-2',
          reversal_id: 'reversal-1',
          reversal_qty: 2,
          order_id: 'o-2',
        }),
      },
    });

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'purchase_order.receipt.reverse',
        severity: 'critical',
        targetId: 'po-2',
        metadata: expect.objectContaining({
          originalReceiptId: 'receipt-2',
          reversalId: 'reversal-1',
          reversalQty: 2,
        }),
      })
    );
  });

  it('falls back to an empty payload object when purchase receipt payload_json is invalid', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.audit({
      db: { prepare: vi.fn() },
      event: {
        id: 'evt-invalid-1',
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_order',
        aggregate_id: 'po-invalid-1',
        correlation_id: 'cmd-invalid-1',
        payload_json: '{',
      },
    });

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        targetId: 'po-invalid-1',
        metadata: expect.objectContaining({
          purchaseOrderItemId: null,
          orderId: null,
          orderLineId: null,
          receiptId: null,
          originalReceiptId: null,
          reversalId: null,
          receivedQty: null,
          reversalQty: null,
        }),
      })
    );
  });

  it('invalidates purchase-order, order, and goods-overview caches idempotently', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.cache({
      event: {
        id: 'evt-2',
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: 'o-1',
        payload_json: JSON.stringify({
          purchase_order_id: 'po-1',
          order_id: 'o-1',
          order_line_id: 'line-1',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledTimes(1);
    const urls = mocks.invalidateCache.mock.calls[0][0];
    expect(urls).toEqual(expect.arrayContaining([
      'https://kk.example.com/api/manage/purchase-orders/po-1',
      'https://kk.example.com/api/manage/orders',
      'https://kk.example.com/api/manage/goods-overview',
      'https://kk.example.com/api/manage/goods-overview/summary',
    ]));
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('invalidates purchase-order detail cache for replayed order procurement events using payload purchase_order_id', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.cache({
      event: {
        id: 'evt-3',
        event_type: 'order_procurement_reversed',
        aggregate_type: 'order',
        aggregate_id: 'o-3',
        payload_json: JSON.stringify({
          purchase_order_id: 'po-3',
          order_id: 'o-3',
          order_line_id: 'line-3',
          reversal_qty: 1,
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    const urls = mocks.invalidateCache.mock.calls.at(-1)[0];
    expect(urls).toEqual(expect.arrayContaining([
      'https://kk.example.com/api/manage/purchase-orders/po-3',
    ]));
  });

  it('invalidates sales order caches for procurement events using all salesperson tokens', async () => {
    mocks.getAllSalespersonAccessTokens.mockResolvedValue(['sales-token-3']);

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-4',
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: 'o-4',
        payload_json: JSON.stringify({
          purchase_order_id: 'po-4',
          order_id: 'o-4',
          procurement_status_after: 'ordered',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    const urls = mocks.invalidateCache.mock.calls.at(-1)[0];
    expect(urls).toEqual(expect.arrayContaining([
      'https://kk.example.com/api/sales/sales-token-3/orders',
      'https://kk.example.com/api/sales/sales-token-3/orders?limit=20&page=1',
      'https://kk.example.com/api/manage/notifications',
    ]));
  });

  it('invalidates manage customer list caches for customer domain events', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-customer-1',
        event_type: 'customer_created',
        aggregate_type: 'customer',
        aggregate_id: 'customer-1',
        payload_json: JSON.stringify({
          customer_id: 'customer-1',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/manage/customers',
      'https://kk.example.com/api/manage/customers?limit=20&page=1',
    ]));
  });

  it('invalidates salesperson order list caches for order read events using salesperson tokens', async () => {
    mocks.getSalespersonAccessTokens.mockResolvedValue(['sales-token-1']);

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-order-read-1',
        event_type: 'order_read_by_sales',
        aggregate_type: 'order',
        aggregate_id: 'order-1',
        payload_json: JSON.stringify({
          order_id: 'order-1',
          salesperson_id: 'sales-1',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/sales/sales-token-1/orders',
      'https://kk.example.com/api/sales/sales-token-1/orders?limit=20&page=1',
    ]));
  });

  it('invalidates order, notification, and analytics caches for line fulfillment updates through the generic order mutation path', async () => {
    mocks.getSalespersonAccessTokens.mockResolvedValue(['sales-token-line']);

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-line-1',
        event_type: 'order_line_fulfillment_updated',
        aggregate_type: 'order',
        aggregate_id: 'order-1',
        payload_json: JSON.stringify({
          order_id: 'order-1',
          order_line_id: 'line-1',
          salesperson_id: 'sales-1',
          action: 'ship',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/manage/orders',
      'https://kk.example.com/api/manage/orders/stats',
      'https://kk.example.com/api/manage/goods-overview',
      'https://kk.example.com/api/manage/notifications',
      'https://kk.example.com/api/sales/sales-token-line/orders',
      'https://kk.example.com/api/sales/sales-token-line/notifications',
    ]));
  });

  it('invalidates sales product list and detail caches for order status changes that change sellable availability', async () => {
    mocks.getSalespersonAccessTokens.mockResolvedValue(['sales-token-order']);
    mocks.getAllSalespersonAccessTokens.mockResolvedValue(['sales-token-order', 'sales-token-peer']);

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-order-status-1',
        event_type: 'order_status_changed_by_admin',
        aggregate_type: 'order',
        aggregate_id: 'order-1',
        payload_json: JSON.stringify({
          order_id: 'order-1',
          salesperson_id: 'sales-1',
          product_id: 'product-1',
          variant_id: 'variant-1',
          status: 'confirmed',
        }),
      },
      baseUrl: 'https://kk.example.com',
      state: {
        invalidatedUrls: new Set(),
        allSalesTokens: null,
        salesTokensById: new Map(),
        refreshedReadModels: new Set(),
        readModelRefreshes: new Map(),
        services: {},
      },
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/sales/sales-token-order/products',
      'https://kk.example.com/api/sales/sales-token-order/products/product-1',
      'https://kk.example.com/api/sales/sales-token-peer/products',
      'https://kk.example.com/api/sales/sales-token-peer/products/product-1',
    ]));
  });

  it('invalidates v1 file detail and folder caches for v1 file update events', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-v1-file-1',
        event_type: 'v1_file_updated',
        aggregate_type: 'file',
        aggregate_id: 'file-1',
        payload_json: JSON.stringify({
          file_id: 'file-1',
          folder_ids: ['folder-1', 'folder-2'],
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/v1/files',
      'https://kk.example.com/api/v1/folders/folder-1',
      'https://kk.example.com/api/v1/folders/folder-2',
      'https://kk.example.com/api/v1/files/file-1',
    ]));
  });

  it('refreshes manage stats and dashboard projections for plain file uploads', async () => {
    const state = {
      invalidatedUrls: new Set(),
      allSalesTokens: null,
      salesTokensById: new Map(),
      refreshedReadModels: new Set(),
      readModelRefreshes: new Map(),
      services: {},
    };

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-file-upload-1',
        event_type: 'file_uploaded',
        aggregate_type: 'file',
        aggregate_id: 'file-1',
        payload_json: JSON.stringify({
          file: { id: 'file-1', filename: 'asset.png' },
        }),
      },
      baseUrl: 'https://kk.example.com',
      state,
    });

    expect(mocks.refreshSystemStats).toHaveBeenCalledWith('manage.stats');
    expect(mocks.refreshSystemStats).toHaveBeenCalledWith('manage.dashboard.overview');
    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/manage/stats',
      'https://kk.example.com/api/manage/dashboard/overview',
    ]));
  });

  it('invalidates v1 folder caches together with share caches for v1 folder events', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-v1-folder-1',
        event_type: 'v1_folder_updated',
        aggregate_type: 'folder',
        aggregate_id: 'folder-1',
        payload_json: JSON.stringify({
          folder_id: 'folder-1',
          parent_ids: ['folder-parent-1'],
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/v1/folders',
      'https://kk.example.com/api/v1/folders?parentId=null',
      'https://kk.example.com/api/v1/folders/folder-parent-1',
      'https://kk.example.com/api/manage/shares',
      'https://kk.example.com/api/manage/shares?limit=20&page=1',
    ]));
  });

  it('invalidates manage and sales space caches for space file reorder events', async () => {
    mocks.getAllSalespersonAccessTokens.mockResolvedValue(['sales-token-2']);

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-space-1',
        event_type: 'space_file_reordered',
        aggregate_type: 'space',
        aggregate_id: 'space-1',
        payload_json: JSON.stringify({
          space_id: 'space-1',
          product_ids: ['product-1'],
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/manage/spaces',
      'https://kk.example.com/api/manage/spaces/space-1',
      'https://kk.example.com/api/manage/spaces/product/product-1',
      'https://kk.example.com/api/sales/sales-token-2/spaces',
      'https://kk.example.com/api/sales/sales-token-2/spaces/space-1',
    ]));
  });

  it('invalidates manage and sales product caches for product events', async () => {
    mocks.getAllSalespersonAccessTokens.mockResolvedValue(['sales-token-3']);

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db: {},
      event: {
        id: 'evt-product-1',
        event_type: 'product_updated',
        aggregate_type: 'product',
        aggregate_id: 'product-1',
        payload_json: JSON.stringify({
          product_id: 'product-1',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/manage/products',
      'https://kk.example.com/api/manage/products/variants',
      'https://kk.example.com/api/sales/sales-token-3/products',
      'https://kk.example.com/api/sales/sales-token-3/products/product-1',
    ]));
  });

  it('invalidates product availability caches for purchase receipt events using payload product_id', async () => {
    mocks.getAllSalespersonAccessTokens.mockResolvedValue(['sales-token-receipt']);
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: sql.includes('FROM spaces')
              ? [{ id: 'space-product-1', parent_id: null }]
              : [],
          })),
        })),
      })),
    };

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db,
      event: {
        id: 'evt-receipt-1',
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-1',
        payload_json: JSON.stringify({
          purchase_order_id: 'po-11',
          product_id: 'product-11',
          variant_id: 'variant-11',
          receipt_id: 'receipt-1',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/manage/purchase-orders/po-11',
      'https://kk.example.com/api/manage/orders',
      'https://kk.example.com/api/manage/products',
      'https://kk.example.com/api/manage/spaces/product/product-11',
      'https://kk.example.com/api/sales/sales-token-receipt/products',
      'https://kk.example.com/api/sales/sales-token-receipt/products/product-11',
      'https://kk.example.com/api/sales/sales-token-receipt/spaces/space-product-1',
    ]));
  });

  it('invalidates product availability caches for inventory receipt events by resolving variant product bindings', async () => {
    mocks.getAllSalespersonAccessTokens.mockResolvedValue(['sales-token-inventory']);
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => {
            if (sql.includes('FROM product_variants')) {
              return {
                results: [{ product_id: 'product-12' }],
              };
            }
            if (sql.includes('FROM spaces')) {
              return {
                results: [{ id: 'space-product-12', parent_id: 'space-parent-12' }],
              };
            }
            return { results: [] };
          }),
        })),
      })),
    };

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db,
      event: {
        id: 'evt-inventory-1',
        event_type: 'inventory_received',
        aggregate_type: 'inventory_event',
        aggregate_id: 'inventory-1',
        payload_json: JSON.stringify({
          variant_id: 'variant-12',
          purchase_receipt_id: 'receipt-12',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/manage/products',
      'https://kk.example.com/api/manage/spaces/product/product-12',
      'https://kk.example.com/api/manage/spaces/space-product-12',
      'https://kk.example.com/api/manage/spaces/space-parent-12',
      'https://kk.example.com/api/manage/spaces/space-parent-12/subspaces',
      'https://kk.example.com/api/sales/sales-token-inventory/products/product-12',
      'https://kk.example.com/api/sales/sales-token-inventory/spaces/space-product-12',
      'https://kk.example.com/api/sales/sales-token-inventory/spaces/space-parent-12',
    ]));
  });

  it('invalidates bound manage and sales space caches for product archive events', async () => {
    mocks.getAllSalespersonAccessTokens.mockResolvedValue(['sales-token-4']);
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [
              { id: 'space-top-1', parent_id: null },
              { id: 'space-child-1', parent_id: 'space-parent-1' },
            ],
          })),
        })),
      })),
    };

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db,
      event: {
        id: 'evt-product-archive-1',
        event_type: 'product_archived',
        aggregate_type: 'product',
        aggregate_id: 'product-9',
        payload_json: JSON.stringify({
          product_id: 'product-9',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('FROM spaces'));
    expect(mocks.invalidateCache).toHaveBeenCalledWith(expect.arrayContaining([
      'https://kk.example.com/api/manage/spaces',
      'https://kk.example.com/api/manage/spaces/product/product-9',
      'https://kk.example.com/api/manage/spaces/space-top-1',
      'https://kk.example.com/api/manage/spaces/space-child-1',
      'https://kk.example.com/api/manage/spaces/space-parent-1',
      'https://kk.example.com/api/manage/spaces/space-parent-1/subspaces',
      'https://kk.example.com/api/sales/sales-token-4/spaces',
      'https://kk.example.com/api/sales/sales-token-4/spaces/space-top-1',
      'https://kk.example.com/api/sales/sales-token-4/spaces/space-child-1',
      'https://kk.example.com/api/sales/sales-token-4/spaces/space-parent-1',
    ]));
  });

  it('refreshes memoized sales tokens after salesperson cache events so later product invalidation reaches new sales sessions', async () => {
    const state = {
      invalidatedUrls: new Set(),
      allSalesTokens: ['sales-token-stale'],
      salesTokensById: new Map([['sales-1', ['sales-token-stale']]]),
      refreshedReadModels: new Set(),
      readModelRefreshes: new Map(),
      services: {},
    };
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [{ id: 'space-top-2', parent_id: null }],
          })),
        })),
      })),
    };

    mocks.getAllSalespersonAccessTokens.mockResolvedValue(['sales-token-fresh']);

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db,
      state,
      event: {
        id: 'evt-salesperson-1',
        event_type: 'salesperson_created',
        aggregate_type: 'salesperson',
        aggregate_id: 'sales-1',
        payload_json: JSON.stringify({
          salesperson_id: 'sales-1',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    await DOMAIN_OUTBOX_CONSUMERS.cache({
      db,
      state,
      event: {
        id: 'evt-product-archive-2',
        event_type: 'product_archived',
        aggregate_type: 'product',
        aggregate_id: 'product-10',
        payload_json: JSON.stringify({
          product_id: 'product-10',
        }),
      },
      baseUrl: 'https://kk.example.com',
    });

    const urls = mocks.invalidateCache.mock.calls.at(-1)[0];
    expect(urls).toEqual(expect.arrayContaining([
      'https://kk.example.com/api/sales/sales-token-fresh/spaces',
      'https://kk.example.com/api/sales/sales-token-fresh/spaces/space-top-2',
    ]));
    expect(urls).not.toEqual(expect.arrayContaining([
      'https://kk.example.com/api/sales/sales-token-stale/spaces',
    ]));
  });
});
