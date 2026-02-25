import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productsApp from '../index.js';

// 模拟 Repository
const mockProductRepo = {
    create: vi.fn(),
    findBySpu: vi.fn(),
    search: vi.fn(),
};

const mockVariantRepo = {
    createBatch: vi.fn(),
};

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
    ProductRepository: class {
        constructor() {}
        create(...args) { return mockProductRepo.create(...args); }
        findBySpu(...args) { return mockProductRepo.findBySpu(...args); }
        search(...args) { return mockProductRepo.search(...args); }
    },
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
    ProductVariantRepository: class {
        constructor() {}
        createBatch(...args) { return mockVariantRepo.createBatch(...args); }
    },
}));

// 模拟缓存中间件
vi.mock('../../../../middleware/cache.js', () => ({
    withCache: () => async (c, next) => await next(),
    invalidateCache: vi.fn(),
    getProductCacheUrls: vi.fn(() => []),
}));

function createApp() {
    const app = new Hono();
    app.onError((err, c) => {
        return c.json(
            { success: false, error: err.message },
            err.statusCode || 500
        );
    });
    app.route('/api/manage/products', productsApp);
    return app;
}

describe('Product Routes — SPU 重构', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ---------------------------------------------------------------
    // POST / — 只需要 name, spu 可选
    // ---------------------------------------------------------------
    describe('POST / — 创建商品', () => {
        it('只提供 name (无 spu) 应成功创建', async () => {
            mockProductRepo.create.mockResolvedValue({
                id: 'test-id',
                name: 'Test Product',
                spu: null,
            });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test Product' }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.name).toBe('Test Product');
        });

        it('缺少 name 应返回 400', async () => {
            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spu: 'SPU-001' }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(400);
        });

        it('重复的非空 spu 应返回 409 冲突', async () => {
            mockProductRepo.findBySpu.mockResolvedValue({ id: 'existing', spu: 'SPU-001' });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test', spu: 'SPU-001' }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(409);
            const body = await res.json();
            expect(body.error).toContain('SPU');
        });

        it('空字符串 spu 不应触发唯一性检查', async () => {
            mockProductRepo.create.mockResolvedValue({
                id: 'test-id',
                name: 'Test',
                spu: null,
            });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test', spu: '' }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
            // findBySpu 不应被调用 (spu 为空)
            expect(mockProductRepo.findBySpu).not.toHaveBeenCalled();
        });

        it('spu 为非字符串时不应抛出 500', async () => {
            mockProductRepo.create.mockResolvedValue({
                id: 'test-id',
                name: 'Test',
                spu: null,
            });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test', spu: 123 }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
        });

        it('响应 payload 应包含 spu 字段', async () => {
            mockProductRepo.findBySpu.mockResolvedValue(null);
            mockProductRepo.create.mockResolvedValue({
                id: 'test-id',
                name: 'Test',
                spu: 'SPU-999',
            });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test', spu: 'SPU-999' }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.data).toHaveProperty('spu', 'SPU-999');
        });
    });
});
