
import { describe, it, expect, vi } from 'vitest';
import { app } from '../functions/lib/hono/app.js';
import { mockEnv } from './utils/mocks.js';
import { generateJWT } from '../functions/api/utils/auth.js';

describe('Search & Tagging API', () => {
    const executionCtx = { waitUntil: vi.fn() };

    describe('Advanced Search', () => {
        it('GET /api/manage/search should handle queries', async () => {
            // Mock DB to return FTS5 results
            const searchResults = [
                { id: '1', name: 'search_result.jpg', storage_key: 'key1', rank: -0.5 }
            ];

            const spy = vi.spyOn(mockEnv.DB, 'prepare').mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    all: vi.fn().mockResolvedValue({ results: searchResults })
                })
            });

            const token = await generateJWT({ id: 'admin1', name: 'Admin', type: 'admin', permissions: ['admin:full'] }, mockEnv);
            const res = await app.request('/api/manage/search?q=test', {
                headers: { 'Authorization': `Bearer ${token}` }
            }, mockEnv, executionCtx);

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(1);

            spy.mockRestore();
        });
    });

    describe('Tag Management', () => {
        it('POST /api/manage/tags should assign tags to files', async () => {
            const spyData = vi.spyOn(mockEnv.DB, 'prepare').mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    run: vi.fn().mockResolvedValue({ success: true }),
                    first: vi.fn().mockResolvedValue({ id: 'tag_1' }),
                    all: vi.fn().mockResolvedValue({ results: [] })
                })
            });

            const token = await generateJWT({ id: 'admin1', name: 'Admin', type: 'admin', permissions: ['admin:full'] }, mockEnv);
            const res = await app.request('/api/manage/tags/assign', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_id: 'file_1',
                    tag_id: 'tag_1'
                })
            }, mockEnv, executionCtx);

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);

            spyData.mockRestore();
        });

        it('GET /api/manage/tags should return distinct tags', async () => {
            const spy = vi.spyOn(mockEnv.DB, 'prepare').mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [{ id: '1', name: 'tagA' }] })
            });

            const token = await generateJWT({ id: 'admin1', name: 'Admin', type: 'admin', permissions: ['admin:full'] }, mockEnv);
            const res = await app.request('/api/manage/tags', {
                headers: { 'Authorization': `Bearer ${token}` }
            }, mockEnv, executionCtx);

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toContainEqual(expect.objectContaining({ name: 'tagA' }));
            spy.mockRestore();
        });
    });
});
