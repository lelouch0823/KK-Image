import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordAuditEvent: vi.fn(async () => ({})),
  invalidateCache: vi.fn(async () => {}),
  getSalespersonAccessTokens: vi.fn(async () => []),
  getAllSalespersonAccessTokens: vi.fn(async () => []),
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
});
