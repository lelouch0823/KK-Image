import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  serviceCreateManagedOrder: vi.fn(),
  ensureOrderFolder: vi.fn(),
  moveFilesToFolder: vi.fn(),
  scheduleCacheInvalidation: vi.fn(),
}));

vi.mock('../../../../../../services/OrderCreationService.js', () => ({
  OrderCreationService: vi.fn(() => ({
    createManagedOrder: mocks.serviceCreateManagedOrder,
  })),
}));

vi.mock('../../../../../../api/utils/folder-utils.js', () => ({
  ensureOrderFolder: mocks.ensureOrderFolder,
  moveFilesToFolder: mocks.moveFilesToFolder,
}));

vi.mock('../../../../_shared/route-helpers.js', () => ({
  buildListCacheUrls: vi.fn(() => ['http://localhost/api/manage/orders']),
  scheduleCacheInvalidation: mocks.scheduleCacheInvalidation,
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getManageOrderCacheUrls: vi.fn(() => ['http://localhost/api/manage/orders']),
}));

vi.mock('../../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: vi.fn(async () => []),
  })),
}));

vi.mock('../../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: vi.fn(async () => ({ claimed: 0 })),
}));

import { createManagedOrder } from '../create-order.js';

describe('createManagedOrder route side effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.serviceCreateManagedOrder.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      salespersonId: 'sales-1',
      fileIds: ['file-1'],
    });
    mocks.ensureOrderFolder.mockResolvedValue('folder-order-1');
    mocks.moveFilesToFolder.mockResolvedValue(undefined);
  });

  it('preserves fileIds in the internal result so idempotency resume can rerun file archiving', async () => {
    const c = {
      env: { DB: {} },
      req: { url: 'http://localhost/api/manage/orders' },
      executionCtx: { waitUntil: vi.fn() },
      get: vi.fn(() => ({ id: 'admin-1', name: 'Admin' })),
    };

    const result = await createManagedOrder(
      c,
      { productName: 'Sample', salespersonId: 'sales-1' },
      { id: 'admin-1', name: 'Admin' },
      { skipOrderCreatedEvent: true }
    );

    expect(result).toEqual({
      id: 'order-1',
      orderNo: 'SO-1',
      salespersonId: 'sales-1',
      fileIds: ['file-1'],
    });
    expect(mocks.scheduleCacheInvalidation).toHaveBeenCalledWith(
      c,
      expect.arrayContaining(['http://localhost/api/manage/orders'])
    );
    expect(mocks.moveFilesToFolder).toHaveBeenCalledWith(c.env, ['file-1'], 'folder-order-1');
  });
});
