import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  listActiveByEvent: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getById: vi.fn(),
  testById: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../repositories/WebhookRepository.js', () => ({
  WebhookRepository: vi.fn(() => ({
    listActiveByEvent: mocks.listActiveByEvent,
    create: mocks.create,
    update: mocks.update,
    getById: mocks.getById,
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
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
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
    mocks.getById.mockResolvedValue({
      id: 'wh-1',
      url: 'https://example.com/hook',
      events: ['purchase_receipt_recorded'],
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
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/hook',
      events: ['purchase_receipt_recorded'],
      actorId: 'admin-1',
    }));

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
});
