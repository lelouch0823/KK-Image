import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoGetAllGrouped: vi.fn(),
  repoUpsert: vi.fn(),
  repoBatchUpsert: vi.fn(),
}));

vi.mock('../../../../../repositories/SettingsRepository.ts', () => ({
  SettingsRepository: vi.fn(() => ({
    getAllGrouped: mocks.repoGetAllGrouped,
    upsert: mocks.repoUpsert,
    batchUpsert: mocks.repoBatchUpsert,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
}));

const { default: featureFlagsApp } = await import('../feature-flags.js');

function createTestApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/feature-flags', featureFlagsApp);
  return app;
}

const ENV = { DB: {} };
const CTX = { waitUntil: vi.fn() };

describe('feature-flags routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /', () => {
    it('returns empty array when no flags exist', async () => {
      mocks.repoGetAllGrouped.mockResolvedValue(null);

      const res = await app.request('/api/manage/feature-flags', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('returns flags from featureFlags category', async () => {
      mocks.repoGetAllGrouped.mockResolvedValue({
        featureFlags: {
          'new-order-flow': 'true',
          'dark-mode': 'false',
        },
        ai: { AI_API_KEY: 'test' },
      });

      const res = await app.request('/api/manage/feature-flags', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(2);
      expect(json.data).toContainEqual({ key: 'new-order-flow', enabled: true, description: null });
      expect(json.data).toContainEqual({ key: 'dark-mode', enabled: false, description: null });
    });

    it('handles empty featureFlags category', async () => {
      mocks.repoGetAllGrouped.mockResolvedValue({ ai: { AI_API_KEY: 'test' } });

      const res = await app.request('/api/manage/feature-flags', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toEqual([]);
    });
  });

  describe('PATCH /:key', () => {
    it('toggles flag enabled state', async () => {
      mocks.repoUpsert.mockResolvedValue(undefined);

      const res = await app.request('/api/manage/feature-flags/new-order-flow', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ key: 'new-order-flow', enabled: true, description: null });
      expect(mocks.repoUpsert).toHaveBeenCalledWith('new-order-flow', {
        value: 'true',
        category: 'featureFlags',
        description: null,
      });
    });

    it('updates description only', async () => {
      mocks.repoGetAllGrouped.mockResolvedValue({
        featureFlags: { 'new-order-flow': 'true' },
      });
      mocks.repoUpsert.mockResolvedValue(undefined);

      const res = await app.request('/api/manage/feature-flags/new-order-flow', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'New order flow' }),
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.description).toBe('New order flow');
      expect(mocks.repoUpsert).toHaveBeenCalledWith('new-order-flow', {
        value: 'true',
        category: 'featureFlags',
        description: 'New order flow',
      });
    });

    it('returns 400 when no fields provided', async () => {
      const res = await app.request('/api/manage/feature-flags/test', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, ENV, CTX);

      expect(res.status).toBe(400);
    });

    it('returns 404 when updating description of non-existent flag', async () => {
      mocks.repoGetAllGrouped.mockResolvedValue({ featureFlags: {} });

      const res = await app.request('/api/manage/feature-flags/unknown', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'test' }),
      }, ENV, CTX);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /', () => {
    it('creates batch flags', async () => {
      mocks.repoBatchUpsert.mockResolvedValue(2);

      const res = await app.request('/api/manage/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flags: [
            { key: 'flag-a', enabled: true },
            { key: 'flag-b', enabled: false, description: 'Test flag' },
          ],
        }),
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.count).toBe(2);
      expect(mocks.repoBatchUpsert).toHaveBeenCalledWith([
        { key: 'flag-a', value: 'true', category: 'featureFlags', description: null },
        { key: 'flag-b', value: 'false', category: 'featureFlags', description: 'Test flag' },
      ]);
    });

    it('returns 400 for invalid body', async () => {
      const res = await app.request('/api/manage/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags: 'not-an-array' }),
      }, ENV, CTX);

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await app.request('/api/manage/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags: [{ key: 'test' }] }),
      }, ENV, CTX);

      expect(res.status).toBe(400);
    });
  });
});
