import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  customerList: vi.fn(),
  customerCreate: vi.fn(),
  customerFindById: vi.fn(),
  customerUpdate: vi.fn(),
  customerHasOrders: vi.fn(),
  customerDelete: vi.fn(),
  salespersonList: vi.fn(),
  salespersonCreate: vi.fn(),
  salespersonFindById: vi.fn(),
  salespersonUpdate: vi.fn(),
  salespersonHasOrders: vi.fn(),
  salespersonDelete: vi.fn(),
  salespersonResetAccessToken: vi.fn(),
  fileFindById: vi.fn(),
  fileUpdate: vi.fn(),
  fileCheckNameConflict: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../repositories/CustomerRepository.js', () => ({
  CustomerRepository: vi.fn(() => ({
    list: mocks.customerList,
    create: mocks.customerCreate,
    findById: mocks.customerFindById,
    update: mocks.customerUpdate,
    hasOrders: mocks.customerHasOrders,
    delete: mocks.customerDelete,
    getBatchRfmSegments: vi.fn(async () => new Map()),
    suggest: vi.fn(async () => []),
    getAllTags: vi.fn(async () => []),
  })),
}));

vi.mock('../../../../../repositories/SalespersonRepository.js', () => ({
  SalespersonRepository: vi.fn(() => ({
    list: mocks.salespersonList,
    create: mocks.salespersonCreate,
    findById: mocks.salespersonFindById,
    update: mocks.salespersonUpdate,
    hasOrders: mocks.salespersonHasOrders,
    delete: mocks.salespersonDelete,
    resetAccessToken: mocks.salespersonResetAccessToken,
  })),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findById: mocks.fileFindById,
    update: mocks.fileUpdate,
    checkNameConflict: mocks.fileCheckNameConflict,
  })),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
  invalidateCache: vi.fn(async () => {}),
}));

vi.mock('../../../../../api/utils/audit.js', () => ({
  logAudit: vi.fn(async () => {}),
  getAuditContext: vi.fn(() => ({ userId: 'u-admin', ip: '127.0.0.1' })),
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import customersApp from '../customers.js';
import salespersonsApp from '../salespersons.js';
import filesApp from '../files.js';

function withUser(app) {
  app.use('/api/manage/*', async (c, next) => {
    c.set('user', {
      id: 'u-admin',
      name: 'Admin',
      type: 'user',
      role: 'admin',
      permissions: ['admin:full'],
    });
    await next();
  });
}

function createApp(basePath, routeApp, env = {}) {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  withUser(app);
  app.route(basePath, routeApp);
  return {
    app,
    env: { DB: {}, JWT_SECRET: 'test-secret', ...env },
  };
}

describe('manage no-op update routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customerList.mockResolvedValue({
      results: [
        {
          id: 'customer-1',
          name: 'Alice',
          phone: '13800000000',
          company: 'Acme',
          email: 'alice@example.com',
          address: 'Shanghai',
          tags: ['vip'],
          remark: 'priority',
          created_by: 'admin',
          created_at: 1,
          updated_at: 2,
        },
      ],
      total: 1,
      pages: 1,
    });
    mocks.customerCreate.mockResolvedValue({ id: 'customer-2', name: 'Bob' });
    mocks.customerFindById.mockResolvedValue({
      id: 'customer-1',
      name: 'Alice',
      phone: '13800000000',
      company: 'Acme',
      email: 'alice@example.com',
      address: 'Shanghai',
      created_by: 'admin',
      created_at: 1,
      updated_at: 1,
      tags: [],
      remark: '',
    });
    mocks.customerUpdate.mockResolvedValue(true);
    mocks.customerHasOrders.mockResolvedValue(false);
    mocks.customerDelete.mockResolvedValue(true);
    mocks.salespersonList.mockResolvedValue({
      results: [
        {
          id: 'sales-1',
          name: 'Bob',
          store: 'Downtown',
          phone: '13900000000',
          access_token: 'token-1',
          is_active: 1,
          order_count: 3,
          created_at: 1,
          updated_at: 2,
        },
      ],
      total: 1,
      pages: 1,
    });
    mocks.salespersonCreate.mockResolvedValue({
      id: 'sales-2',
      name: 'Carol',
      store: 'Pudong',
      phone: '13700000000',
      access_token: 'token-2',
      is_active: 1,
    });
    mocks.salespersonFindById.mockResolvedValue({
      id: 'sales-1',
      name: 'Bob',
      store: 'Downtown',
      phone: '13900000000',
      access_token: 'token-1',
      is_active: 1,
      created_at: 1,
      updated_at: 2,
    });
    mocks.salespersonUpdate.mockResolvedValue(true);
    mocks.salespersonHasOrders.mockResolvedValue(false);
    mocks.salespersonDelete.mockResolvedValue(true);
    mocks.salespersonResetAccessToken.mockResolvedValue('reset-token-1');
    mocks.fileFindById.mockResolvedValue({
      id: 'file-1',
      name: 'hero.jpg',
      folder_id: 'root',
      storage_key: 'hero-key',
      created_at: 1,
      updated_at: 1,
    });
    mocks.fileUpdate.mockResolvedValue(undefined);
    mocks.fileCheckNameConflict.mockResolvedValue(false);
  });

  it('lists customers with camelCase fields and pagination payload', async () => {
    const { app, env } = createApp('/api/manage/customers', customersApp);

    const res = await app.request(
      'http://localhost/api/manage/customers?page=2&limit=5&search=ali',
      {},
      env
    );

    if (res.status !== 200) {
      const errorBody = await res.text();
      console.error('Customer list error:', res.status, errorBody);
    }
    expect(res.status).toBe(200);
    expect(mocks.customerList).toHaveBeenCalledWith({ page: 2, limit: 5, search: 'ali' });
    const body = await res.json();
    expect(body.data).toEqual([
      expect.objectContaining({
        id: 'customer-1',
        createdBy: 'admin',
        createdAt: 1,
        updatedAt: 2,
      }),
    ]);
    expect(body.pagination.totalPages).toBe(1);
  });

  it('returns customer detail with camelCase response fields', async () => {
    const { app, env } = createApp('/api/manage/customers', customersApp);

    const res = await app.request('http://localhost/api/manage/customers/customer-1', {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        id: 'customer-1',
        createdBy: 'admin',
        createdAt: 1,
        updatedAt: 1,
        phone: '13800000000',
      })
    );
  });

  it('creates a customer and schedules cache plus outbox side effects', async () => {
    const { app, env } = createApp('/api/manage/customers', customersApp);
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/customers',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bob', phone: '13600000000' }),
      },
      env,
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.customerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Bob',
        phone: '13600000000',
        createdBy: 'Admin',
      })
    );
    expect(mocks.publish).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          event_type: 'customer_created',
          aggregate_id: 'customer-2',
        }),
      ],
      undefined
    );
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  it('returns 200 for customer no-op update', async () => {
    const { app, env } = createApp('/api/manage/customers', customersApp);
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/customers/customer-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      },
      env,
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.customerUpdate).toHaveBeenCalledWith(
      'customer-1',
      expect.objectContaining({ name: 'Alice' })
    );
    const [publishedEvents, publishContext] = mocks.publish.mock.calls[0];
    expect(publishContext).toBeUndefined();
    expect(publishedEvents).toEqual([
      expect.objectContaining({
        event_type: 'customer_updated',
        aggregate_type: 'customer',
        aggregate_id: 'customer-1',
        payload: { customer_id: 'customer-1' },
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'customer.update', domain: 'customers' })
    );
  });

  it('rejects customer deletion when linked orders exist', async () => {
    mocks.customerHasOrders.mockResolvedValueOnce(true);
    const { app, env } = createApp('/api/manage/customers', customersApp);

    const res = await app.request(
      'http://localhost/api/manage/customers/customer-1',
      { method: 'DELETE' },
      env
    );

    expect(res.status).toBe(400);
    expect(mocks.customerDelete).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('lists salespersons with derived access token fields', async () => {
    const { app, env } = createApp('/api/manage/salespersons', salespersonsApp);

    const res = await app.request(
      'http://localhost/api/manage/salespersons?page=3&limit=7&search=bob',
      {},
      env
    );

    expect(res.status).toBe(200);
    expect(mocks.salespersonList).toHaveBeenCalledWith({ page: 3, limit: 7, search: 'bob' });
    const body = await res.json();
    expect(body.data).toEqual([
      expect.objectContaining({
        id: 'sales-1',
        isActive: true,
        orderCount: 3,
      }),
    ]);
    expect(body.data[0]).not.toHaveProperty('accessToken');
  });

  it('returns salesperson detail with transformed active flag', async () => {
    const { app, env } = createApp('/api/manage/salespersons', salespersonsApp);

    const res = await app.request('http://localhost/api/manage/salespersons/sales-1', {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(
      expect.objectContaining({
        id: 'sales-1',
        isActive: true,
      })
    );
    expect(body.data).not.toHaveProperty('accessToken');
  });

  it('creates a salesperson and publishes the create event', async () => {
    const { app, env } = createApp('/api/manage/salespersons', salespersonsApp);
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/salespersons',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Carol',
          store: 'Pudong',
          phone: '13700000000',
          password: 'secret',
        }),
      },
      env,
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.salespersonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Carol',
        store: 'Pudong',
        phone: '13700000000',
        password: 'secret',
      })
    );
    expect(mocks.publish).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          event_type: 'salesperson_created',
          aggregate_id: 'sales-2',
        }),
      ],
      undefined
    );
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  it('returns 200 for salesperson no-op update', async () => {
    const { app, env } = createApp('/api/manage/salespersons', salespersonsApp);
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/salespersons/sales-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bob' }),
      },
      env,
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.salespersonUpdate).toHaveBeenCalledWith(
      'sales-1',
      expect.objectContaining({ name: 'Bob' })
    );
    const [publishedEvents, publishContext] = mocks.publish.mock.calls[0];
    expect(publishContext).toBeUndefined();
    expect(publishedEvents).toEqual([
      expect.objectContaining({
        event_type: 'salesperson_updated',
        aggregate_type: 'salesperson',
        aggregate_id: 'sales-1',
        payload: { salesperson_id: 'sales-1' },
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('rejects salesperson deletion when linked orders exist', async () => {
    mocks.salespersonHasOrders.mockResolvedValueOnce(true);
    const { app, env } = createApp('/api/manage/salespersons', salespersonsApp);

    const res = await app.request(
      'http://localhost/api/manage/salespersons/sales-1',
      { method: 'DELETE' },
      env
    );

    expect(res.status).toBe(400);
    expect(mocks.salespersonDelete).not.toHaveBeenCalled();
  });

  it('resets salesperson access token and returns the new token', async () => {
    const { app, env } = createApp('/api/manage/salespersons', salespersonsApp);
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/salespersons/sales-1/reset-token',
      { method: 'POST' },
      env,
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.salespersonResetAccessToken).toHaveBeenCalledWith('sales-1');
    const body = await res.json();
    expect(body.data).toEqual({ accessToken: 'reset-token-1' });
    expect(mocks.publish).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          event_type: 'salesperson_token_reset',
          aggregate_id: 'sales-1',
        }),
      ],
      undefined
    );
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('returns 200 for file rename no-op and skips conflict check', async () => {
    const { app, env } = createApp('/api/manage/files', filesApp);

    const res = await app.request(
      'http://localhost/api/manage/files/file-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'hero.jpg' }),
      },
      env,
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.fileCheckNameConflict).not.toHaveBeenCalled();
    expect(mocks.fileUpdate).toHaveBeenCalledWith('file-1', { name: 'hero.jpg' });
  });
});
