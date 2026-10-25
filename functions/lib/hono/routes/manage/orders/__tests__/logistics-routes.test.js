import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  orderFindById: vi.fn(),
  timelineAdd: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  updateRun: vi.fn(async () => ({ meta: { changes: 1 } })),
}));

vi.mock('../../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.orderFindById,
    timelineRepo: {
      addTimelineEntry: mocks.timelineAdd,
    },
  })),
}));

vi.mock('../../../../../../services/LogisticsService.js', () => ({
  LogisticsService: vi.fn(() => ({
    queryTracking: vi.fn(async () => []),
    getSupportedCarriers: vi.fn(() => ['express']),
  })),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import logisticsApp from '../detail/logistics.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', logisticsApp);
  return app;
}

function createDb() {
  return {
    prepare: vi.fn((sql) => ({
      sql,
      bind: vi.fn(() => ({
        run: mocks.updateRun,
        first: vi.fn(async () => null),
      })),
    })),
  };
}

describe('manage order logistics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderFindById.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      currentData: {},
      trackingNo: '',
      carrier: 'express',
    });
    mocks.updateRun.mockResolvedValue({ meta: { changes: 1 } });
  });

  it('does not write timeline or audit when the active-order logistics update is stale', async () => {
    mocks.updateRun.mockResolvedValueOnce({ meta: { changes: 0 } });
    const app = createApp();
    const db = createDb();

    const res = await app.request(
      '/api/manage/orders/order-1/logistics',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNo: 'T-1', carrier: 'express' }),
      },
      { DB: db }
    );

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('archived_at IS NULL');
    // R9（F9）：0 行命中后按"是否归档"区分——mock first() 返回 null
    //（非归档），归因于 CAS 失败（并发修改）→ 409
    expect(res.status).toBe(409);
    expect(mocks.timelineAdd).not.toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).not.toHaveBeenCalled();
  });

  it('reports 400 when the order is archived (R9 distinguishes CAS loss from archive)', async () => {
    mocks.updateRun.mockResolvedValueOnce({ meta: { changes: 0 } });
    const app = createApp();
    const db = createDb();
    // fresh 查询返回已归档 → 400 归档文案
    db.prepare = vi.fn((sql) => ({
      sql,
      bind: vi.fn(() => ({
        run: mocks.updateRun,
        first: vi.fn(async () => ({ archived_at: 123 })),
      })),
    }));

    const res = await app.request(
      '/api/manage/orders/order-1/logistics',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNo: 'T-1', carrier: 'express' }),
      },
      { DB: db }
    );

    expect(res.status).toBe(400);
    expect(mocks.timelineAdd).not.toHaveBeenCalled();
  });
});
