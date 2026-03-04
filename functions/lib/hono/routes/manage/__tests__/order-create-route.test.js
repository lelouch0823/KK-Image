import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  orderCreate: vi.fn(),
  validateProductVariantBinding: vi.fn(),
  getSalespersonAccessTokens: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  ensureOrderFolder: vi.fn(),
  moveFilesToFolder: vi.fn(),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    create: mocks.orderCreate,
  })),
}));

vi.mock('../../../../../api/utils/validation.js', () => ({
  validateProductVariantBinding: mocks.validateProductVariantBinding,
}));

vi.mock('../../../_shared/route-helpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSalespersonAccessTokens: mocks.getSalespersonAccessTokens,
  };
});

vi.mock('../../../middleware/cache.js', () => ({
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getOrderAndSalespersonCacheUrls: vi.fn(() => []),
  getOrderNotificationCacheUrls: vi.fn(() => []),
}));

vi.mock('../../../../../api/utils/folder-utils.js', () => ({
  ensureOrderFolder: mocks.ensureOrderFolder,
  moveFilesToFolder: mocks.moveFilesToFolder,
}));

import createAppRoutes from '../orders/create.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', createAppRoutes);
  return app;
}

describe('manage order create route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderCreate.mockResolvedValue({ id: 'order-1', orderNo: 'SO-1001' });
    mocks.validateProductVariantBinding.mockResolvedValue({ normalizedVariantId: null });
    mocks.getSalespersonAccessTokens.mockResolvedValue([]);
    mocks.ensureOrderFolder.mockResolvedValue('folder-order-1');
    mocks.moveFilesToFolder.mockResolvedValue(undefined);
  });

  it('archives uploaded files into order folder after creating order', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          quantity: 1,
          fileIds: ['file-1', 'file-2'],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.ensureOrderFolder).toHaveBeenCalledTimes(1);
    expect(mocks.ensureOrderFolder).toHaveBeenCalledWith(expect.anything(), expect.any(String));
    expect(mocks.moveFilesToFolder).toHaveBeenCalledWith(
      expect.anything(),
      ['file-1', 'file-2'],
      'folder-order-1'
    );
  });
});
