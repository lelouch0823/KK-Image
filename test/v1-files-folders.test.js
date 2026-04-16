
import { app } from '../functions/lib/hono/app.js';
import { mockEnv } from './utils/mocks.js';
import { generateJWT } from '../functions/api/utils/auth.js';
import assert from 'assert';

const mockExecutionCtx = {
    waitUntil: (promise) => Promise.resolve(promise).catch(console.error),
    passThroughOnException: () => { }
};

describe('V1 API: Files & Folders', () => {
    let adminToken;
    let userToken;

    before(async () => {
        // Generate tokens for tests
        const adminUser = { id: 'admin', name: 'Admin', type: 'admin', permissions: ['admin:full'] };
        const normalUser = {
            id: 'user',
            name: 'User',
            type: 'user',
            permissions: ['files:read', 'files:write', 'folders:read']
        };

        adminToken = await generateJWT(adminUser, mockEnv);
        userToken = await generateJWT(normalUser, mockEnv);
    });

    describe('Files API', () => {
        it('POST /api/v1/files - Create file (Auth required)', async () => {
            const res = await app.request('/api/v1/files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({ name: 'test.jpg', isPublic: true })
            }, mockEnv, mockExecutionCtx);

            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.data.name, 'test.jpg');
        });

        it('GET /api/v1/files - List files (Auth required)', async () => {
            const res = await app.request('/api/v1/files', {
                headers: { 'Authorization': `Bearer ${userToken}` }
            }, mockEnv, mockExecutionCtx);

            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.success, true);
            assert.ok(Array.isArray(data.data));
        });

        it('GET /api/v1/files/:id - Get file', async () => {
            const res = await app.request('/api/v1/files/test-id', {
                headers: { 'Authorization': `Bearer ${userToken}` }
            }, mockEnv, mockExecutionCtx);

            // Mock D1 returns a file for any ID
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.data.id, 'test-id');
        });

        it('DELETE /api/v1/files/:id - Delete file', async () => {
            // Mock user needs files:delete permission. Our test user has files:write but not explicit delete?
            // Check permissions: 'files:write' creates, 'files:delete' deletes.
            // Let's use admin token for delete
            const res = await app.request('/api/v1/files/test-id', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, mockEnv, mockExecutionCtx);

            assert.strictEqual(res.status, 200);
        });
    });

    describe('Folders API', () => {
        it('POST /api/v1/folders - Create folder', async () => {
            const res = await app.request('/api/v1/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ name: 'New Folder' })
            }, mockEnv, mockExecutionCtx);

            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.strictEqual(data.data.name, 'New Folder');
        });

        it('GET /api/v1/folders - List folders', async () => {
            const res = await app.request('/api/v1/folders', {
                headers: { 'Authorization': `Bearer ${userToken}` }
            }, mockEnv, mockExecutionCtx);

            assert.strictEqual(res.status, 200);
        });
    });

});
