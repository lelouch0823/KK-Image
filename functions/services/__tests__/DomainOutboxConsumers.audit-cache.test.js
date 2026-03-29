import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordAuditEvent: vi.fn(async () => ({})),
  invalidateCache: vi.fn(async () => {}),
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

import { DOMAIN_OUTBOX_CONSUMERS } from '../DomainOutboxConsumers.js';

describe('DomainOutboxConsumers audit and cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
