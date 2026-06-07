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

import backupsApp from '../backups.js';

function createApp(user = { id: 'admin-1', name: 'Admin', role: 'admin', type: 'admin' }) {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/backups/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/manage/backups', backupsApp);
  return app;
}

function createEnv({
  environment = 'development',
  branch = 'feature/restore',
  object = {
    key: 'backup-2026-04-18.zip',
    size: 4096,
    uploaded: new Date('2026-04-18T12:00:00.000Z'),
    httpEtag: 'etag-1',
  },
} = {}) {
  return {
    ENVIRONMENT: environment,
    CF_PAGES_BRANCH: branch,
    R2_BACKUP_BUCKET: {
      head: vi.fn(async () => object),
    },
  };
}

describe('manage backup restore routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiredPermissions.length = 0;
  });

  it('validates one backup and returns restore safety metadata', async () => {
    const app = createApp();
    const env = createEnv();

    const res = await app.request(
      'http://localhost/api/manage/backups/backup-2026-04-18.zip/validate',
      { method: 'POST' },
      env,
      { waitUntil: vi.fn() }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.requiredPermissions).toContain('admin:full');
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          name: 'backup-2026-04-18.zip',
          size: 4096,
          uploadedAt: '2026-04-18T12:00:00.000Z',
          mode: 'validate',
          allowed: true,
        }),
      })
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'backup.restore.validate',
        result: 'success',
        severity: 'high',
        targetId: 'backup-2026-04-18.zip',
        metadata: expect.objectContaining({
          allowed: true,
          environment: 'development',
        }),
      })
    );
  });

  it('returns a dry-run restore summary without mutating data', async () => {
    const app = createApp();
    const env = createEnv({ environment: 'preview', branch: 'preview' });

    const res = await app.request(
      'http://localhost/api/manage/backups/backup-2026-04-18.zip/dry-run',
      { method: 'POST' },
      env,
      { waitUntil: vi.fn() }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          name: 'backup-2026-04-18.zip',
          mode: 'dry-run',
          allowed: true,
          dryRun: true,
          steps: expect.arrayContaining([expect.stringContaining('Verify backup object')]),
        }),
      })
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'backup.restore.dry_run',
        result: 'success',
      })
    );
  });

  it('blocks restore execution in production environments', async () => {
    const app = createApp();
    const env = createEnv({ environment: 'production', branch: 'main' });

    const res = await app.request(
      'http://localhost/api/manage/backups/backup-2026-04-18.zip/restore',
      { method: 'POST' },
      env,
      { waitUntil: vi.fn() }
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Restore execution is disabled'),
      })
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'backup.restore.execute',
        result: 'denied',
        severity: 'critical',
        targetId: 'backup-2026-04-18.zip',
      })
    );
  });

  it('returns an audit-only restore execution summary outside production', async () => {
    const app = createApp();
    const env = createEnv({ environment: 'preview', branch: 'preview' });

    const res = await app.request(
      'http://localhost/api/manage/backups/backup-2026-04-18.zip/restore',
      { method: 'POST' },
      env,
      { waitUntil: vi.fn() }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          name: 'backup-2026-04-18.zip',
          mode: 'restore',
          allowed: true,
          dryRun: false,
          executed: false,
          restoreMode: 'audit-summary-only',
        }),
      })
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'backup.restore.execute',
        result: 'success',
        metadata: expect.objectContaining({
          restoreMode: 'audit-summary-only',
        }),
      })
    );
  });
});
