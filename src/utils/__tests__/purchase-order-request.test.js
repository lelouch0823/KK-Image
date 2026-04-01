import { describe, expect, it } from 'vitest';

import {
  appendPurchaseOrderCacheBust,
  buildPurchaseOrderIdempotentJsonHeaders,
} from '../purchase-order-request.js';

describe('purchase-order-request helpers', () => {
  it('appends _ts only when forceRefresh is true', () => {
    expect(appendPurchaseOrderCacheBust('/api/manage/purchase-orders')).toBe(
      '/api/manage/purchase-orders'
    );

    expect(
      appendPurchaseOrderCacheBust('/api/manage/purchase-orders?page=1', {
        forceRefresh: true,
        now: () => 123,
      })
    ).toBe('/api/manage/purchase-orders?page=1&_ts=123');
  });

  it('builds idempotent json headers from a supplied id creator', () => {
    expect(
      buildPurchaseOrderIdempotentJsonHeaders({ createId: () => 'idem-1' })
    ).toEqual({
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-1',
    });
  });
});
