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
import userApp from '../user.js';
import searchApp from '../search.js';
import notificationsApp from '../notifications.js';

function withUser(app, user) {
  app.use('/api/manage/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
}

function createNotificationDbStub() {
  return {
    prepare() {
      return {
        bind() {
          return {
            all: async () => ({ results: [] }),
            first: async () => ({ count: 0 }),
            run: async () => ({}),
          };
        },
        all: async () => ({ results: [] }),
        first: async () => ({ count: 0 }),
        run: async () => ({}),
      };
    },
  };
}

function ensureCacheApi() {
  if (globalThis.caches?.default) return;
  globalThis.caches = {
    default: {
      match: async () => null,
      put: async () => {},
      delete: async () => true,
    },
  };
}

describe('manage core authz gates', () => {
  ensureCacheApi();

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

  it('denies spaces create when user only has read + files:write direct permissions', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-direct', type: 'user', role: 'guest', permissions: ['read', 'files:write'] });
    app.route('/api/manage/spaces', spacesApp);

    const res = await app.request(
      'http://localhost/api/manage/spaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'space-a' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies spaces file mutation when user only has read + files:write direct permissions', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-direct', type: 'user', role: 'guest', permissions: ['read', 'files:write'] });
    app.route('/api/manage/spaces', spacesApp);

    const res = await app.request(
      'http://localhost/api/manage/spaces/sp-1/files',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ['f-1'] }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('denies /manage/user when user only has legacy read direct permission', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-direct', type: 'user', role: 'guest', permissions: ['read'] });
    app.route('/api/manage/user', userApp);

    const res = await app.request('http://localhost/api/manage/user', { method: 'GET' }, { DB: {} }, { waitUntil: vi.fn() });
    expect(res.status).toBe(403);
  });

  it('allows /manage/user when user has files:read direct permission', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-direct', type: 'user', role: 'guest', permissions: ['files:read'] });
    app.route('/api/manage/user', userApp);

    const res = await app.request('http://localhost/api/manage/user', { method: 'GET' }, { DB: {} }, { waitUntil: vi.fn() });
    expect(res.status).toBe(200);
  });

  it('denies /manage/search when user only has legacy read direct permission', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-direct', type: 'user', role: 'guest', permissions: ['read'] });
    app.route('/api/manage/search', searchApp);

    const res = await app.request('http://localhost/api/manage/search', { method: 'GET' }, { DB: {} }, { waitUntil: vi.fn() });
    expect(res.status).toBe(403);
  });

  it('denies /manage/notifications list when user only has files:read direct permission', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-direct', type: 'user', role: 'guest', permissions: ['files:read'] });
    app.route('/api/manage/notifications', notificationsApp);

    const res = await app.request(
      'http://localhost/api/manage/notifications',
      { method: 'GET' },
      { DB: createNotificationDbStub() },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });

  it('allows /manage/notifications list when user has notifications:read direct permission', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-direct', type: 'user', role: 'guest', permissions: ['notifications:read'] });
    app.route('/api/manage/notifications', notificationsApp);

    const res = await app.request(
      'http://localhost/api/manage/notifications',
      { method: 'GET' },
      { DB: createNotificationDbStub() },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(200);
  });

  it('denies /manage/notifications create when user only has files:write direct permission', async () => {
    const app = new Hono();
    withUser(app, { id: 'u-direct', type: 'user', role: 'guest', permissions: ['files:write'] });
    app.route('/api/manage/notifications', notificationsApp);

    const res = await app.request(
      'http://localhost/api/manage/notifications',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'n1' }),
      },
      { DB: createNotificationDbStub() },
      { waitUntil: vi.fn() }
    );
    expect(res.status).toBe(403);
  });
});
