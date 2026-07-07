import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoGetAllGrouped: vi.fn(),
}));

vi.mock('../../../../../repositories/SettingsRepository.js', () => ({
  SettingsRepository: vi.fn(() => ({
    getAllGrouped: mocks.repoGetAllGrouped,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../_shared/audit-helpers.js', () => ({
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

const { default: settingsApp } = await import('../settings.js');

function createApp() {
  const app = new Hono();
  app.route('/api/manage/settings', settingsApp);
  return app;
}

describe('manage settings cache policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repoGetAllGrouped.mockResolvedValue({
      ai: {
        AI_API_KEY: 'sk-secret',
      },
    });
  });

  it('does not allow secret-bearing settings responses to be cached publicly', async () => {
    const app = createApp();

    const res = await app.request('http://localhost/api/manage/settings', {}, { DB: {} });

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
    expect(res.headers.get('Cache-Control')).not.toMatch(/public/);
  });
});
