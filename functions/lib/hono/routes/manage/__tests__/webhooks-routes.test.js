import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  listAll: vi.fn(),
  listActiveByEvent: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getById: vi.fn(),
  getByIdWithSecret: vi.fn(),
  testById: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../repositories/WebhookRepository.js', () => ({
  WebhookRepository: vi.fn(() => ({
    listAll: mocks.listAll,
    listActiveByEvent: mocks.listActiveByEvent,
    create: mocks.create,
    update: mocks.update,
    delete: mocks.remove,
    getById: mocks.getById,
    getByIdWithSecret: mocks.getByIdWithSecret,
    testById: mocks.testById,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import webhooksApp from '../webhooks.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/webhooks/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin', role: 'admin', type: 'admin' });
    await next();
  });
  app.route('/api/manage/webhooks', webhooksApp);
  return app;
}

describe('manage webhooks routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAll.mockResolvedValue([]);
    mocks.listActiveByEvent.mockResolvedValue([]);
    mocks.create.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      events: ['purchase_receipt_recorded'],
      headers: {},
      enabled: true,
    });
    mocks.update.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook-2',
      events: ['order_procurement_progressed'],
      headers: { 'X-KK': '2' },
      enabled: false,
    });
    mocks.remove.mockResolvedValue(true);
    mocks.getById.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      events: ['purchase_receipt_recorded'],
      headers: {},
      enabled: true,
    });
    mocks.getByIdWithSecret.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      events: ['purchase_receipt_recorded'],
      secret: 'existing-secret',
      headers: {},
      enabled: true,
    });
    mocks.testById.mockResolvedValue({ status: 200, success: true });
  });

  it('creates and updates manage webhook configs under /api/manage/webhooks', async () => {
    const app = createApp();

    const createRes = await app.request(
      'http://localhost/api/manage/webhooks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/hook',
          events: ['purchase_receipt_recorded'],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(createRes.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/hook',
        events: ['purchase_receipt_recorded'],
        actorId: 'admin-1',
      })
    );

    const updateRes = await app.request(
      'http://localhost/api/manage/webhooks/wh-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/hook-2',
          events: ['order_procurement_progressed'],
          enabled: false,
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(updateRes.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      'wh-1',
      expect.objectContaining({
        url: 'https://example.com/hook-2',
        events: ['order_procurement_progressed'],
        enabled: false,
        actorId: 'admin-1',
      })
    );
  });

  it('preserves existing webhook fields on partial update', async () => {
    const app = createApp();

    const updateRes = await app.request(
      'http://localhost/api/manage/webhooks/wh-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: false,
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(updateRes.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith('wh-1', {
      url: 'https://example.com/hook',
      events: ['purchase_receipt_recorded'],
      secret: 'existing-secret',
      headers: {},
      enabled: false,
      actorId: 'admin-1',
    });
  });

  it('lists only webhook-capable supported events and rejects cache-only event subscriptions', async () => {
    const app = createApp();

    const listRes = await app.request(
      'http://localhost/api/manage/webhooks',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.supportedEvents).toContain('purchase_receipt_recorded');
    expect(listJson.supportedEvents).toContain('file_uploaded');
    expect(listJson.supportedEvents).not.toContain('product_archived');
    expect(listJson.supportedEvents).not.toContain('order_line_fulfillment_updated');

    const rejectRes = await app.request(
      'http://localhost/api/manage/webhooks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/hook',
          events: ['product_archived'],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(rejectRes.status).toBe(400);
    await expect(rejectRes.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('invalid webhook events: product_archived'),
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('deletes manage webhook configs under /api/manage/webhooks/:id', async () => {
    const app = createApp();

    const deleteRes = await app.request(
      'http://localhost/api/manage/webhooks/wh-1',
      {
        method: 'DELETE',
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(deleteRes.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith('wh-1');
  });
});
