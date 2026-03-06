import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  listForAdmin: vi.fn(),
  salespersonsAll: vi.fn(),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    listForAdmin: mocks.listForAdmin,
  })),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
}));

import listRoutes from '../orders/list.js';

const createDb = () => ({
  prepare: vi.fn(() => ({
    all: mocks.salespersonsAll,
  })),
});

const createApp = () => {
  const app = new Hono();
  app.route('/api/manage/orders', listRoutes);
  return app;
};

describe('manage order list routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listForAdmin.mockImplementation(async ({ page, limit }) => ({
      items: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    }));
    mocks.salespersonsAll.mockResolvedValue({ results: [] });
  });

  it('clamps page and limit bounds via parsePagination', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders?page=0&limit=500',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listForAdmin).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 100 }));
  });

  it('clamps negative values to minimum bounds', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders?page=-3&limit=0',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listForAdmin).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 1 }));
  });

  it('passes valid procurementStatus to repository query options', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders?procurementStatus=ordered',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listForAdmin).toHaveBeenCalledWith(expect.objectContaining({ procurementStatus: 'ordered' }));
  });

  it('normalizes invalid procurementStatus to null', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders?procurementStatus=invalid',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listForAdmin).toHaveBeenCalledWith(expect.objectContaining({ procurementStatus: null }));
  });
});
