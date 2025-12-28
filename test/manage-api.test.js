
import { app } from '../functions/lib/hono/app.js';
import { mockEnv } from './utils/mocks.js';
import { generateJWT } from '../functions/api/utils/auth.js';
import assert from 'assert';

const mockExecutionCtx = {
    waitUntil: (promise) => Promise.resolve(promise).catch(console.error),
    passThroughOnException: () => { }
};

describe('Manage API', () => {
    let adminToken;

    before(async () => {
        const adminUser = { id: 'admin', name: 'Admin', type: 'admin', permissions: ['admin:full'] };
        adminToken = await generateJWT(adminUser, mockEnv);
    });

    describe('Manage Folders', () => {
        it('GET /api/manage/folders', async () => {
            const res = await app.request('/api/manage/folders', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 200);
        });

        it('POST /api/manage/folders', async () => {
            const res = await app.request('/api/manage/folders', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: 'Manage Folder' })
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 201);
        });
    });

    describe('Manage Files', () => {
        it('GET /api/manage/files', async () => {
            const res = await app.request('/api/manage/files', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 200);
        });

        it('POST /api/manage/files/batch/delete', async () => {
            const res = await app.request('/api/manage/files/batch/delete', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: ['file1', 'file2'] })
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 200);
        });
    });

    describe('Manage Albums', () => {
        it('GET /api/manage/albums', async () => {
            const res = await app.request('/api/manage/albums', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 200);
        });

        it('POST /api/manage/albums', async () => {
            const res = await app.request('/api/manage/albums', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: 'New Album' })
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 201);
        });
    });

    describe('Manage Spaces', () => {
        it('GET /api/manage/spaces', async () => {
            const res = await app.request('/api/manage/spaces', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 200);
        });

        it('POST /api/manage/spaces', async () => {
            const res = await app.request('/api/manage/spaces', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: 'New Space' })
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 201);
        });
    });

    describe('Manage Stats', () => {
        it('GET /api/manage/stats', async () => {
            const res = await app.request('/api/manage/stats', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, mockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 200);
        });
    });

});
