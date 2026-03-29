import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  dryRun: vi.fn(),
  executeReplay: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../services/OutboxReplayService.js', () => ({
  OutboxReplayService: vi.fn(() => ({
    dryRun: mocks.dryRun,
    executeReplay: mocks.executeReplay,
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

import auditReplayApp from '../audit-replay.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/manage/audit-replay/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin', role: 'admin', type: 'admin' });
    await next();
  });
  app.route('/api/manage/audit-replay', auditReplayApp);
  return app;
}

describe('manage audit replay routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dryRun.mockResolvedValue({
      runId: 'replay-1',
      status: 'completed',
      dryRun: true,
    });
    mocks.executeReplay.mockResolvedValue({
      runId: 'replay-2',
      status: 'completed',
      dryRun: false,
    });
  });

  it('accepts dry-run replay requests only for admin users', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/audit-replay/dry-run',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeType: 'event',
          scopeId: 'evt-1',
          consumerName: 'notification',
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.dryRun).toHaveBeenCalledWith(expect.objectContaining({
      scopeType: 'event',
      scopeId: 'evt-1',
      consumerName: 'notification',
      requestedBy: 'admin-1',
    }));
  });
});
