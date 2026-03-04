import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import customersApp from '../customers.js';
import salespersonsApp from '../salespersons.js';
import settingsApp from '../settings.js';
import purchaseOrdersApp from '../purchase-orders.js';
import aiApp from '../ai.js';
import utilsApp from '../utils.js';
import filesApp from '../files.js';
import foldersApp from '../folders.js';
import albumsApp from '../albums.js';
import spacesApp from '../spaces/index.js';

function withUser(app, user) {
  app.use('/api/manage/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
}

describe('manage core authz gates', () => {
  it('denies viewer on customers list', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-viewer', type: 'user', role: 'viewer', permissions: [] });
    app.route('/api/manage/customers', customersApp);

    const res = await app.request(
      'http://localhost/api/manage/customers',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies manager on salesperson write operations', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-manager', type: 'user', role: 'manager', permissions: [] });
    app.route('/api/manage/salespersons', salespersonsApp);

    const res = await app.request(
      'http://localhost/api/manage/salespersons',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'sales-a', password: '123456' }),
      },
      { DB: {}, JWT_SECRET: 'test-secret' },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies manager on settings access', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-manager', type: 'user', role: 'manager', permissions: [] });
    app.route('/api/manage/settings', settingsApp);

    const res = await app.request(
      'http://localhost/api/manage/settings',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies viewer on purchase orders list', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-viewer', type: 'user', role: 'viewer', permissions: [] });
    app.route('/api/manage/purchase-orders', purchaseOrdersApp);

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies sales role on manage ai chat', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-sales', type: 'user', role: 'sales', permissions: [] });
    app.route('/api/manage/ai', aiApp);

    const res = await app.request(
      'http://localhost/api/manage/ai/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], context: {} }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies viewer on hash check utility', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-viewer', type: 'user', role: 'viewer', permissions: [] });
    app.route('/api/manage/utils', utilsApp);

    const res = await app.request(
      'http://localhost/api/manage/utils/check-hash?hash=abc',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies unknown role on files list', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-guest', type: 'user', role: 'guest', permissions: [] });
    app.route('/api/manage/files', filesApp);

    const res = await app.request(
      'http://localhost/api/manage/files',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies unknown role on folders list', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-guest', type: 'user', role: 'guest', permissions: [] });
    app.route('/api/manage/folders', foldersApp);

    const res = await app.request(
      'http://localhost/api/manage/folders',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies unknown role on albums list', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-guest', type: 'user', role: 'guest', permissions: [] });
    app.route('/api/manage/albums', albumsApp);

    const res = await app.request(
      'http://localhost/api/manage/albums',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies unknown role on spaces list', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-guest', type: 'user', role: 'guest', permissions: [] });
    app.route('/api/manage/spaces', spacesApp);

    const res = await app.request(
      'http://localhost/api/manage/spaces',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });
});
