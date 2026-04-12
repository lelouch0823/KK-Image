import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  publishSingleDomainEventAndPoll: vi.fn(async () => []),
}));

vi.mock('../../../../_shared/domain-outbox.js', () => ({
  publishSingleDomainEventAndPoll: mocks.publishSingleDomainEventAndPoll,
}));

import { scheduleProductCacheInvalidation } from '../cache-helpers.js';

describe('manage products cache outbox helper', () => {
  it('publishes a cache-only product domain event instead of invalidating synchronously', async () => {
    const c = {
      req: { url: 'http://localhost/api/manage/products/p-1' },
      env: { DB: {} },
      executionCtx: { waitUntil: vi.fn() },
    };

    await scheduleProductCacheInvalidation(c, {
      eventType: 'product_variant_image_deleted',
      productIds: ['p-1'],
    });

    expect(mocks.publishSingleDomainEventAndPoll).toHaveBeenCalledWith(
      c,
      expect.objectContaining({
        event_type: 'product_variant_image_deleted',
        aggregate_type: 'product',
        aggregate_id: 'p-1',
        payload: {
          product_id: 'p-1',
          product_ids: ['p-1'],
        },
      }),
      'product_variant_image_deleted:p-1',
      undefined
    );
  });
});
