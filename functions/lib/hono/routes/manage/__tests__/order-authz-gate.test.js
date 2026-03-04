import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  listForAdmin: vi.fn(),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    listForAdmin: mocks.listForAdmin,
  })),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
}));

import ordersRoutes from '../orders/index.js';

const createDb = () => ({
  prepare: vi.fn(() => ({
    all: vi.fn(async () => ({ results: [] })),
  })),
});

const createApp = (user) => {
  const app = new Hono();
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/manage/orders', ordersRoutes);
  return app;
};

describe('manage order route authz gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listForAdmin.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('denies viewer on GET /api/manage/orders', async () => {
    const app = createApp({ id: 'u-viewer', type: 'user', role: 'viewer', permissions: [] });

    const res = await app.request(
      'http://localhost/api/manage/orders',
      { method: 'GET' },
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(403);
  });

  it('allows manager on GET /api/manage/orders', async () => {
    const app = createApp({ id: 'u-manager', type: 'user', role: 'manager', permissions: [] });

    const res = await app.request(
      'http://localhost/api/manage/orders',
      { method: 'GET' },
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
  });
});
