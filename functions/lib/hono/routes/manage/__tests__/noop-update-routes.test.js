import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  customerFindById: vi.fn(),
  customerUpdate: vi.fn(),
  salespersonUpdate: vi.fn(),
  fileFindById: vi.fn(),
  fileUpdate: vi.fn(),
  fileCheckNameConflict: vi.fn(),
}));

vi.mock('../../../../../repositories/CustomerRepository.js', () => ({
  CustomerRepository: vi.fn(() => ({
    findById: mocks.customerFindById,
    update: mocks.customerUpdate,
  })),
}));

vi.mock('../../../../../repositories/SalespersonRepository.js', () => ({
  SalespersonRepository: vi.fn(() => ({
    update: mocks.salespersonUpdate,
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

import customersApp from '../customers.js';
import salespersonsApp from '../salespersons.js';
import filesApp from '../files.js';

function withUser(app) {
  app.use('/api/manage/*', async (c, next) => {
    c.set('user', { id: 'u-admin', name: 'Admin', type: 'user', role: 'admin', permissions: ['admin:full'] });
    await next();
  });
}

function createApp(basePath, routeApp, env = {}) {
  const app = new Hono();
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
    mocks.customerFindById.mockResolvedValue({
      id: 'customer-1',
      name: 'Alice',
      created_by: 'admin',
      created_at: 1,
      updated_at: 1,
      tags: [],
    });
    mocks.customerUpdate.mockResolvedValue(true);
    mocks.salespersonUpdate.mockResolvedValue(true);
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

  it('returns 200 for customer no-op update', async () => {
    const { app, env } = createApp('/api/manage/customers', customersApp);

    const res = await app.request(
      'http://localhost/api/manage/customers/customer-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      },
      env,
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.customerUpdate).toHaveBeenCalledWith('customer-1', expect.objectContaining({ name: 'Alice' }));
  });

  it('returns 200 for salesperson no-op update', async () => {
    const { app, env } = createApp('/api/manage/salespersons', salespersonsApp);

    const res = await app.request(
      'http://localhost/api/manage/salespersons/sales-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bob' }),
      },
      env,
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.salespersonUpdate).toHaveBeenCalledWith('sales-1', expect.objectContaining({ name: 'Bob' }));
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
