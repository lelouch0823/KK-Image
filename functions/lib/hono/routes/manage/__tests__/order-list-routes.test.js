import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { DateUtils } from '../../../../../_shared/utils.js';

const mocks = vi.hoisted(() => ({
  listForAdmin: vi.fn(),
  salespersonsAll: vi.fn(),
  getAdminStats: vi.fn(),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    listForAdmin: mocks.listForAdmin,
  })),
}));

vi.mock('../../../../../repositories/OrderStatsRepository.js', () => ({
  OrderStatsRepository: vi.fn(() => ({
    getAdminStats: mocks.getAdminStats,
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
    mocks.getAdminStats.mockResolvedValue({
      today: 4,
      week: 12,
      month: 20,
      statusDistribution: { pending: 3, fulfilled: 5 },
      deliveryStatusDistribution: {
        in_transit: 2,
        delivered: 6,
        partially_returned: 1,
        returned: 1,
      },
      awaitingDelivery: 2,
      delivered: 6,
      partiallyReturned: 1,
      returned: 1,
      recentTrend: [],
    });
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
    expect(mocks.listForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100 })
    );
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
    expect(mocks.listForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ procurementStatus: 'ordered' })
    );
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
    expect(mocks.listForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ procurementStatus: null })
    );
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

    expect(payload.procurementStatuses).toContain('unprocured');
    expect(payload.procurementStatuses).toContain('partially_received');
    expect(payload.procurementStatuses).not.toContain('none');
    expect(payload.procurementStatuses).not.toContain('partially_arrived');
  });

  it('normalizes legacy delivered status filter to canonical fulfilled query', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders?status=delivered',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fulfilled' })
    );
  });

  it('returns canonical order status filter options without legacy delivered alias', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    const payload = await res.json();

    expect(payload.statuses).toContain('fulfilled');
    expect(payload.statuses).not.toContain('delivered');
  });

  it('passes deliveryStatus through to repository query options and exposes delivery filter options', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders?deliveryStatus=partially_returned',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'partially_returned' })
    );

    const payload = await res.json();
    expect(payload.deliveryStatuses).toEqual([
      'not_shipped',
      'in_transit',
      'delivered',
      'partially_returned',
      'returned',
    ]);
  });

  it('returns post-fulfillment dashboard counters from GET /stats', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/stats',
      {},
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.data).toMatchObject({
      todayCount: 4,
      pendingCount: 3,
      weekCount: 12,
      awaitingDeliveryCount: 2,
      deliveredCount: 6,
      partiallyReturnedCount: 1,
      returnedCount: 1,
    });
    expect(payload.data.deliveryStatusDistribution).toEqual({
      in_transit: 2,
      delivered: 6,
      partially_returned: 1,
      returned: 1,
    });
  });

  it('falls back to snapshot_name when exporting orders whose current_data lost the product name', async () => {
    const exportStmt = {
      bind: vi.fn(() => exportStmt),
      all: vi.fn(async () => ({
        results: [
          {
            id: 'o-1',
            order_no: 'SO-1',
            current_data: JSON.stringify({}),
            status: 'confirmed',
            salesperson_name: 'Alice',
            created_at: 1710000000000,
            snapshot_name: 'Snapshot Chair',
          },
        ],
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

  it('excludes archived orders from exports even when exporting selected ids', async () => {
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
      'http://localhost/api/manage/orders/export?ids=o-archived',
      {},
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(db.prepare.mock.calls[0][0]).toContain('o.archived_at IS NULL');
    expect(exportStmt.bind).toHaveBeenCalledWith('o-archived');
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
    expect(exportStmt.bind).toHaveBeenCalledWith(
      '%Snapshot Chair%',
      '%Snapshot Chair%',
      '%Snapshot Chair%'
    );
  });

  it('exports fulfillment, delivery, and returned quantity columns and forwards delivery filters', async () => {
    const exportStmt = {
      bind: vi.fn(() => exportStmt),
      all: vi.fn(async () => ({
        results: [
          {
            id: 'o-1',
            order_no: 'SO-1',
            current_data: JSON.stringify({ name: 'Walnut Chair' }),
            status: 'fulfilled',
            fulfillment_status: 'fulfilled',
            delivery_status: 'partially_returned',
            line_returned_qty: 2,
            salesperson_name: 'Alice',
            created_at: 1710000000000,
            snapshot_name: 'Snapshot Chair',
          },
        ],
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
      'http://localhost/api/manage/orders/export?deliveryStatus=partially_returned',
      {},
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(db.prepare.mock.calls[0][0]).toContain('partially_returned');
    expect(exportStmt.bind).toHaveBeenCalledWith('partially_returned');

    const csv = await res.text();
    expect(csv).toContain('履约状态');
    expect(csv).toContain('物流状态');
    expect(csv).toContain('退回数量');
    expect(csv).toContain('部分退回');
    expect(csv).toContain('"2"');
  });

  it('neutralizes spreadsheet formula prefixes in exported order csv cells', async () => {
    const exportStmt = {
      bind: vi.fn(() => exportStmt),
      all: vi.fn(async () => ({
        results: [
          {
            id: 'o-1',
            order_no: '=SO-1',
            current_data: JSON.stringify({ name: '+CMD' }),
            status: 'fulfilled',
            fulfillment_status: 'fulfilled',
            delivery_status: 'delivered',
            line_returned_qty: 0,
            salesperson_name: '@Alice',
            created_at: 1710000000000,
            snapshot_name: '-Snapshot',
          },
        ],
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
    const csv = await res.text();
    expect(csv).toContain(`"'=SO-1"`);
    expect(csv).toContain(`"'+CMD"`);
    expect(csv).toContain(`"'@Alice"`);
  });

  it('exports localized order status labels for canonical and legacy fulfilled rows', async () => {
    const exportStmt = {
      bind: vi.fn(() => exportStmt),
      all: vi.fn(async () => ({
        results: [
          {
            id: 'o-1',
            order_no: 'SO-1',
            current_data: JSON.stringify({ name: 'Chair' }),
            status: 'fulfilled',
            fulfillment_status: 'fulfilled',
            delivery_status: 'in_transit',
            line_returned_qty: 0,
            salesperson_name: 'Alice',
            created_at: 1710000000000,
            snapshot_name: 'Chair',
          },
          {
            id: 'o-2',
            order_no: 'SO-2',
            current_data: JSON.stringify({ name: 'Lamp' }),
            status: 'delivered',
            fulfillment_status: 'fulfilled',
            delivery_status: 'delivered',
            line_returned_qty: 0,
            salesperson_name: 'Bob',
            created_at: 1710000000000,
            snapshot_name: 'Lamp',
          },
        ],
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
    const csv = await res.text();
    expect(csv).toContain('"履约完成"');
    expect(csv).not.toContain('"fulfilled"');
    expect(csv).not.toContain('"delivered"');
  });

  it('forwards salesperson and date range filters and expands fulfilled export status alias', async () => {
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
      'http://localhost/api/manage/orders/export?salesperson=sp-1&status=fulfilled&from=2026-04-01&to=2026-04-14',
      {},
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(db.prepare.mock.calls[0][0]).toContain('o.salesperson_id = ?');
    expect(db.prepare.mock.calls[0][0]).toContain('o.status IN (?, ?)');
    expect(exportStmt.bind).toHaveBeenCalledWith(
      'sp-1',
      'fulfilled',
      'delivered',
      DateUtils.parseChinaDate('2026-04-01'),
      DateUtils.parseChinaDate('2026-04-14') + 86400000
    );
  });
});
