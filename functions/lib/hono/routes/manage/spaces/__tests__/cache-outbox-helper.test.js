import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  publishSingleDomainEventAndPoll: vi.fn(async () => []),
}));

vi.mock('../../../../_shared/domain-outbox.js', () => ({
  publishSingleDomainEventAndPoll: mocks.publishSingleDomainEventAndPoll,
}));

import { invalidateSpaceCaches } from '../cache-helpers.js';

describe('manage spaces cache outbox helper', () => {
  it('publishes a cache-only space domain event instead of invalidating synchronously', async () => {
    const c = {
      req: { url: 'http://localhost/api/manage/spaces/sp-1' },
      env: { DB: {} },
      executionCtx: { waitUntil: vi.fn() },
    };

    await invalidateSpaceCaches(c, {
      eventType: 'space_file_reordered',
      spaceId: 'sp-1',
      parentId: 'parent-1',
      productIds: ['prod-1'],
    });

    expect(mocks.publishSingleDomainEventAndPoll).toHaveBeenCalledWith(
      c,
      expect.objectContaining({
        event_type: 'space_file_reordered',
        aggregate_type: 'space',
        aggregate_id: 'sp-1',
        payload: {
          space_id: 'sp-1',
          parent_id: 'parent-1',
          product_ids: ['prod-1'],
        },
      }),
      'space_file_reordered:sp-1'
    );
  });
});
