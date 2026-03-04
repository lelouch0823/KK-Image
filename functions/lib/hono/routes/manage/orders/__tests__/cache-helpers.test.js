import { beforeEach, describe, expect, it, vi } from 'vitest';

const cacheMocks = vi.hoisted(() => ({
  getSalespersonAccessTokens: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  getOrderNotificationCacheUrls: vi.fn(() => ['n1']),
  getOrderAndSalespersonCacheUrls: vi.fn(() => ['o1']),
}));

vi.mock('../../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/route-helpers.js');
  return {
    ...actual,
    getSalespersonAccessTokens: cacheMocks.getSalespersonAccessTokens,
  };
});

vi.mock('../../../../middleware/cache.js', async () => {
  const actual = await vi.importActual('../../../../middleware/cache.js');
  return {
    ...actual,
    invalidateCache: cacheMocks.invalidateCache,
  };
});

vi.mock('../../../_shared/cache-urls.js', async () => {
  const actual = await vi.importActual('../../../_shared/cache-urls.js');
  return {
    ...actual,
    getOrderNotificationCacheUrls: cacheMocks.getOrderNotificationCacheUrls,
    getOrderAndSalespersonCacheUrls: cacheMocks.getOrderAndSalespersonCacheUrls,
  };
});

import {
  resolveSalesTokens,
  scheduleOrderNotificationCacheInvalidation,
  scheduleOrderAndSalespersonCacheInvalidation,
  scheduleOrderMutationCachesInvalidation,
} from '../cache-helpers.js';

describe('orders cache helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheMocks.getSalespersonAccessTokens.mockResolvedValue(['t1']);
  });

  it('resolveSalesTokens filters empty salesperson ids before lookup', async () => {
    const db = {};
    const tokens = await resolveSalesTokens(db, ['sp-1', '', null, 'sp-2', undefined]);
    expect(tokens).toEqual(['t1']);
    expect(cacheMocks.getSalespersonAccessTokens).toHaveBeenCalledWith(db, ['sp-1', 'sp-2']);
  });

  it('schedule helpers enqueue invalidation with expected urls', async () => {
    const waitUntil = vi.fn();
    const c = { executionCtx: { waitUntil } };

    scheduleOrderNotificationCacheInvalidation(c, { salesTokens: ['ts'] });
    scheduleOrderAndSalespersonCacheInvalidation(c, { salesTokens: ['ts'] });

    expect(cacheMocks.getOrderNotificationCacheUrls).toHaveBeenCalledWith(c, { salesTokens: ['ts'] });
    expect(cacheMocks.getOrderAndSalespersonCacheUrls).toHaveBeenCalledWith(c, { salesTokens: ['ts'] });
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  it('scheduleOrderMutationCachesInvalidation enqueues both cache groups', () => {
    const waitUntil = vi.fn();
    const c = { executionCtx: { waitUntil } };

    scheduleOrderMutationCachesInvalidation(c, { salesTokens: ['ts2'] });

    expect(cacheMocks.getOrderNotificationCacheUrls).toHaveBeenCalledWith(c, { salesTokens: ['ts2'] });
    expect(cacheMocks.getOrderAndSalespersonCacheUrls).toHaveBeenCalledWith(c, { salesTokens: ['ts2'] });
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });
});
