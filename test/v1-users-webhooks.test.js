import { app } from '../functions/lib/hono/app.js';
import { mockEnv } from './utils/mocks.js';
import { generateJWT } from '../functions/api/utils/auth.js';
import assert from 'assert';

const mockExecutionCtx = {
  waitUntil: (promise) => Promise.resolve(promise).catch(console.error),
  passThroughOnException: () => {},
};

describe('V1 API: Users & Webhooks', () => {
  let adminToken;
  let userToken;

  before(async () => {
    const adminUser = { id: 'admin', name: 'Admin', type: 'admin', permissions: ['admin:full'] };
    const normalUser = { id: 'user', name: 'User', type: 'user', permissions: [] }; // No admin perms

    adminToken = await generateJWT(adminUser, mockEnv);
    userToken = await generateJWT(normalUser, mockEnv);
  });

  describe('Users API', () => {
    it('GET /api/v1/users - Admin can list users', async () => {
      const res = await app.request(
        '/api/v1/users',
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        mockEnv,
        mockExecutionCtx
      );

      assert.strictEqual(res.status, 200);
    });

    it('GET /api/v1/users - Normal user denied', async () => {
      const res = await app.request(
        '/api/v1/users',
        {
          headers: { Authorization: `Bearer ${userToken}` },
        },
        mockEnv,
        mockExecutionCtx
      );

      // Should be 403 Forbidden
      assert.strictEqual(res.status, 403);
    });

    it('GET /api/v1/users/me - Get current user', async () => {
      const res = await app.request(
        '/api/v1/users/me',
        {
          headers: { Authorization: `Bearer ${userToken}` },
        },
        mockEnv,
        mockExecutionCtx
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.id, 'user');
    });
  });

  describe('Permissions API', () => {
    it('GET /api/v1/permissions - List permissions', async () => {
      const res = await app.request(
        '/api/v1/permissions',
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        mockEnv,
        mockExecutionCtx
      );
      assert.strictEqual(res.status, 200);
    });
  });

  describe('Webhooks API', () => {
    it('GET /api/v1/webhooks - List webhooks', async () => {
      const res = await app.request(
        '/api/v1/webhooks',
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        mockEnv,
        mockExecutionCtx
      );
      assert.strictEqual(res.status, 200);
    });

    it('POST /api/v1/webhooks - Create webhook', async () => {
      const res = await app.request(
        '/api/v1/webhooks',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Test Webhook',
            url: 'https://example.com/hook',
            events: ['file_uploaded'],
          }),
        },
        mockEnv,
        mockExecutionCtx
      );
      assert.strictEqual(res.status, 201);
    });
  });
});
