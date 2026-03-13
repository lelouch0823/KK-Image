import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  generatePrefixedId: vi.fn(),
  generateHmacSignature: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  },
}));

vi.mock('../../../_shared/utils.js', () => ({
  generatePrefixedId: mocks.generatePrefixedId,
  generateHmacSignature: mocks.generateHmacSignature,
  MSG: {
    WEBHOOK: {
      URL_REQUIRED: 'URL_REQUIRED',
      INVALID_EVENTS: 'INVALID_EVENTS',
      NOT_FOUND: 'NOT_FOUND',
      DELETE_SUCCESS: 'DELETE_SUCCESS',
    },
  },
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
    requireEntity: async (promise, onNotFound) => {
      const entity = await promise;
      if (!entity) throw onNotFound();
      return entity;
    },
  };
});

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import webhooksApp from '../webhooks.js';

function createDb() {
  const runs = [];
  return {
    runs,
    prepare: vi.fn((sql) => ({
      bind: vi.fn((...args) => ({
        all: vi.fn(async () => ({ results: [] })),
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM webhooks WHERE id = ?')) {
            return {
              id: 'wh_1',
              url: 'https://example.com/hook',
              events: JSON.stringify(['webhook.test']),
              secret: 'secret',
              headers: JSON.stringify({}),
              enabled: 1,
              created_by: 'Admin',
              created_at: 1,
              updated_by: 'Admin',
              updated_at: 1,
            };
          }
          if (sql.includes('SELECT id FROM webhooks WHERE id = ?')) {
            return { id: args[0] };
          }
          return null;
        }),
        run: vi.fn(async () => {
          runs.push({ sql, args });
          return { success: true };
        }),
      })),
    })),
  };
}

describe('v1 webhooks routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generatePrefixedId
      .mockReturnValueOnce('wh_1')
      .mockReturnValueOnce('log_1');
    mocks.generateHmacSignature.mockResolvedValue('sig');
  });

  it('audits webhook creation', async () => {
    const db = createDb();
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/webhooks', webhooksApp);

    const res = await app.request(
      'http://localhost/api/v1/webhooks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/hook' }),
      },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'v1.webhook.create',
        targetId: 'wh_1',
        target_label: 'https://example.com/hook',
      })
    );
  });

  it('audits webhook test execution', async () => {
    const db = createDb();
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/webhooks', webhooksApp);
    const fetchMock = vi.fn(async () => ({ status: 202, statusText: 'Accepted', ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const res = await app.request(
        'http://localhost/api/v1/webhooks/wh_1/test',
        { method: 'POST' },
        { DB: db },
        { waitUntil: vi.fn() }
      );

      expect(res.status).toBe(200);
      expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'v1.webhook.test',
          targetId: 'wh_1',
          target_label: 'https://example.com/hook',
          metadata: expect.objectContaining({ status: 202, ok: true }),
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
