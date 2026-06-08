import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  recordAuditEvent: vi.fn(async () => {}),
}));

vi.mock('../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../_shared/audit-helpers.js');
  return {
    ...actual,
    recordAuditEvent: mocks.recordAuditEvent,
  };
});

import { errorHandler } from '../errorHandler.js';

describe('errorHandler audit coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records failed audit events for high-risk export GET paths', async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get('/api/manage/audit-logs/export', () => {
      throw new Error('export failed');
    });

    const response = await app.request(
      'http://localhost/api/manage/audit-logs/export',
      {},
      { DB: {} }
    );

    expect(response.status).toBe(500);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        result: 'failed',
        action: 'audit-logs.get.failed',
        metadata: expect.objectContaining({
          path: '/api/manage/audit-logs/export',
          method: 'GET',
        }),
      })
    );
  });
});
