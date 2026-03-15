import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  scheduleAuditEvent: vi.fn(),
  requiredPermissions: [],
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: (permission) => async (_c, next) => {
    mocks.requiredPermissions.push(permission);
    await next();
  },
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import auditLogsApp from '../audit-logs.js';

function createDb() {
  return {
    prepare: vi.fn((sql) => {
      const all = vi.fn(async () => {
        if (sql.includes('SELECT DISTINCT action')) {
          return { results: [{ action: 'order.create' }] };
        }
        if (sql.includes('SELECT id, user_id')) {
          return {
            results: [
              {
                id: 'audit-1',
                actor_id: 'admin-1',
                actor_name: 'Admin',
                action: 'order.create',
                domain: 'orders',
                result: 'success',
                severity: 'high',
                target_type: 'order',
                target_id: 'order-1',
                target_label: 'SO-1',
                summary: 'Created order SO-1',
                metadata_json: '{"reason":"manual"}',
                created_at: 123,
              },
            ],
          };
        }
        return { results: [] };
      });

      return {
        all,
        bind: vi.fn((...args) => ({
          first: vi.fn(async () => {
            if (sql.includes('COUNT(*) as total')) return { total: 1 };
            return null;
          }),
          all,
        })),
      };
    }),
  };
}

describe('manage audit log routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiredPermissions.length = 0;
  });

  it('exports filtered audit logs as csv and records the export event', async () => {
    const app = new Hono();
    app.route('/api/manage/audit-logs', auditLogsApp);
    const res = await app.request(
      'http://localhost/api/manage/audit-logs/export?format=csv&domain=orders',
      { method: 'GET' },
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('audit-logs-export');
    expect(await res.text()).toContain('order.create');
    expect(mocks.requiredPermissions).toContain('audit:export');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'audit.export',
        domain: 'audit-logs',
        metadata: expect.objectContaining({ format: 'csv', domain: 'orders', count: 1 }),
      })
    );
  });

  it('neutralizes spreadsheet formula prefixes in csv exports', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => (sql.includes('COUNT(*) as total') ? { total: 1 } : null)),
          all: vi.fn(async () => {
            if (!sql.includes('SELECT id, user_id')) return { results: [] };
            return {
              results: [
                {
                  id: 'audit-2',
                  actor_id: 'admin-2',
                  actor_name: '=cmd|calc',
                  action: 'order.update',
                  domain: 'orders',
                  result: 'success',
                  severity: 'normal',
                  target_type: 'order',
                  target_id: 'order-2',
                  target_label: '+SUM(1,2)',
                  summary: '@danger',
                  created_at: 456,
                },
              ],
            };
          }),
        })),
      })),
    };
    const app = new Hono();
    app.route('/api/manage/audit-logs', auditLogsApp);

    const res = await app.request(
      'http://localhost/api/manage/audit-logs/export?format=csv',
      { method: 'GET' },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain("\"'=cmd|calc\"");
    expect(csv).toContain("\"'+SUM(1,2)\"");
    expect(csv).toContain("\"'@danger\"");
  });

  it('records audit log list reads', async () => {
    const app = new Hono();
    app.route('/api/manage/audit-logs', auditLogsApp);

    const res = await app.request(
      'http://localhost/api/manage/audit-logs?page=2&pageSize=25&result=denied',
      { method: 'GET' },
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.requiredPermissions).toContain('audit:read');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'audit.read',
        domain: 'audit-logs',
        result: 'success',
        targetType: 'audit_log',
        metadata: expect.objectContaining({
          page: 2,
          pageSize: 25,
          count: 1,
          result: 'denied',
        }),
      })
    );
  });

  it('records audit log action catalog reads', async () => {
    const app = new Hono();
    app.route('/api/manage/audit-logs', auditLogsApp);

    const res = await app.request(
      'http://localhost/api/manage/audit-logs/actions',
      { method: 'GET' },
      { DB: createDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.requiredPermissions).toContain('audit:read');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'audit.actions.read',
        domain: 'audit-logs',
        result: 'success',
        targetType: 'audit_log',
        metadata: expect.objectContaining({
          count: 1,
        }),
      })
    );
  });
});
