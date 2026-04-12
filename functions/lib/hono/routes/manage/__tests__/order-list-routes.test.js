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

  it('accepts line-level displayStatus vocabulary in procurementStatus query', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders?procurementStatus=partially_received',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ procurementStatus: 'partially_received' })
    );
  });

  it('normalizes legacy procurementStatus aliases to canonical progress filters', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders?procurementStatus=none',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ procurementStatus: 'unprocured' })
    );
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

  it('returns canonical progress filter options without legacy duplicate aliases', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    const payload = await res.json();

    expect(payload.data.procurementStatuses).toContain('unprocured');
    expect(payload.data.procurementStatuses).toContain('partially_received');
    expect(payload.data.procurementStatuses).not.toContain('none');
    expect(payload.data.procurementStatuses).not.toContain('partially_arrived');
  });
  it('falls back to snapshot_name when exporting orders whose current_data lost the product name', async () => {
    const exportStmt = {
      bind: vi.fn(() => exportStmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'o-1',
          order_no: 'SO-1',
          current_data: JSON.stringify({}),
          status: 'confirmed',
          salesperson_name: 'Alice',
          created_at: 1710000000000,
          snapshot_name: 'Snapshot Chair',
        }],
      })),
    };
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('FROM orders o')) return exportStmt;
        return { all: mocks.salespersonsAll };
      }),
    };
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/orders/export',
      {},
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(db.prepare.mock.calls[0][0]).toContain('snapshot_name');
    const csv = await res.text();
    expect(csv).toContain('Snapshot Chair');
  });

  it('extends export search filters to snapshot_name fallback when current_data name is missing', async () => {
    const exportStmt = {
      bind: vi.fn(() => exportStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('FROM orders o')) return exportStmt;
        return { all: mocks.salespersonsAll };
      }),
    };
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/orders/export?search=Snapshot%20Chair',
      {},
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(db.prepare.mock.calls[0][0]).toContain('order_line_snapshot.snapshot_name LIKE ?');
    expect(exportStmt.bind).toHaveBeenCalledWith('%Snapshot Chair%', '%Snapshot Chair%', '%Snapshot Chair%');
  });

});
