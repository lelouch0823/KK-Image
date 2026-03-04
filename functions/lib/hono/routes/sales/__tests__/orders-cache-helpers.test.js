import { beforeEach, describe, expect, it, vi } from 'vitest';

const cacheMocks = vi.hoisted(() => ({
  invalidateCache: vi.fn(async () => {}),
  getSalesOrderCacheUrls: vi.fn(() => ['sales-list-url']),
  getOrderAndSalespersonCacheUrls: vi.fn(() => ['orders-url']),
  getOrderNotificationCacheUrls: vi.fn(() => ['notification-url']),
  getManageOrderCacheUrls: vi.fn(() => ['manage-orders-url']),
}));

vi.mock('../../../middleware/cache.js', async () => {
  const actual = await vi.importActual('../../../middleware/cache.js');
  return {
    ...actual,
    invalidateCache: cacheMocks.invalidateCache,
  };
});

vi.mock('../../_shared/cache-urls.js', async () => {
  const actual = await vi.importActual('../../_shared/cache-urls.js');
  return {
    ...actual,
    getSalesOrderCacheUrls: cacheMocks.getSalesOrderCacheUrls,
    getOrderAndSalespersonCacheUrls: cacheMocks.getOrderAndSalespersonCacheUrls,
    getOrderNotificationCacheUrls: cacheMocks.getOrderNotificationCacheUrls,
    getManageOrderCacheUrls: cacheMocks.getManageOrderCacheUrls,
  };
});

import {
  scheduleSalesOrderListCacheInvalidation,
  scheduleOrderAndSalespersonCacheInvalidation,
  scheduleOrderNotificationCacheInvalidation,
  scheduleSalesOrderMutationCachesInvalidation,
  scheduleSalesCommentCachesInvalidation,
} from '../orders-cache-helpers.js';

describe('sales orders cache helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules sales order list cache invalidation with token-scoped urls', () => {
    const waitUntil = vi.fn();
    const c = { executionCtx: { waitUntil } };

    scheduleSalesOrderListCacheInvalidation(c, { salesToken: 'token-1' });

    expect(cacheMocks.getSalesOrderCacheUrls).toHaveBeenCalledWith(c, { salesTokens: ['token-1'] });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('schedules shared order notification and order list cache invalidation', () => {
    const waitUntil = vi.fn();
    const c = { executionCtx: { waitUntil } };

    scheduleSalesOrderMutationCachesInvalidation(c, { salesToken: 'token-2' });

    expect(cacheMocks.getOrderAndSalespersonCacheUrls).toHaveBeenCalledWith(c, { salesTokens: ['token-2'] });
    expect(cacheMocks.getOrderNotificationCacheUrls).toHaveBeenCalledWith(c);
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  it('schedules comment-related caches for admin views', () => {
    const waitUntil = vi.fn();
    const c = { executionCtx: { waitUntil } };

    scheduleSalesCommentCachesInvalidation(c);

    expect(cacheMocks.getOrderNotificationCacheUrls).toHaveBeenCalledWith(c);
    expect(cacheMocks.getManageOrderCacheUrls).toHaveBeenCalledWith(c);
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  it('exports direct single-cache scheduling helpers', () => {
    const waitUntil = vi.fn();
    const c = { executionCtx: { waitUntil } };

    scheduleOrderAndSalespersonCacheInvalidation(c, { salesToken: 'token-3' });
    scheduleOrderNotificationCacheInvalidation(c);

    expect(cacheMocks.getOrderAndSalespersonCacheUrls).toHaveBeenCalledWith(c, { salesTokens: ['token-3'] });
    expect(cacheMocks.getOrderNotificationCacheUrls).toHaveBeenCalledWith(c);
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });
});
