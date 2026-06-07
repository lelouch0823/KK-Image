import { app } from '../functions/lib/hono/app.js';
import { mockEnv } from './utils/mocks.js';
import assert from 'assert';

const mockExecutionCtx = {
  waitUntil: (promise) => {
    // No-op for tests, or await if needed
    Promise.resolve(promise).catch(console.error);
  },
  passThroughOnException: () => {},
};

describe('SOTA API (Hono)', () => {
  describe('Health Check', () => {
    it('GET /api/v1/health should return 200 OK', async () => {
      const res = await app.request('/api/v1/health', {}, mockEnv, mockExecutionCtx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'healthy');
      assert.strictEqual(data.version, '2.0.0');
    });

    it('GET /api/v1/health/info should return API info', async () => {
      const res = await app.request('/api/v1/health/info', {}, mockEnv, mockExecutionCtx);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.framework, 'Hono');
    });
  });

  describe('Authentication', () => {
    it('POST /api/v1/auth/login with valid credentials', async () => {
      const payload = {
        username: 'admin',
        password: 'password',
      };

      const res = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        mockEnv,
        mockExecutionCtx
      );

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.id, 'admin');
    });

    it('POST /api/v1/auth/login with invalid credentials', async () => {
      const payload = {
        username: 'admin',
        password: 'wrongpassword',
      };

      const res = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        mockEnv,
        mockExecutionCtx
      );

      assert.strictEqual(res.status, 401);
    });
  });

  describe('Files API (Public)', () => {
    it('GET /api/v1/files without auth should return 401', async () => {
      const res = await app.request('/api/v1/files', {}, mockEnv, mockExecutionCtx);
      assert.strictEqual(res.status, 401);
    });
  });

  describe('Manage API', () => {
    it('GET /api/manage/folders without auth should return 401', async () => {
      const res = await app.request('/api/manage/folders', {}, mockEnv, mockExecutionCtx);
      assert.strictEqual(res.status, 401);
    });
  });
});
