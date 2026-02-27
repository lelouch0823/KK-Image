import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productsApp from '../index.js';

const mockProductRepo = {
    create: vi.fn(),
    findBySpu: vi.fn(),
    search: vi.fn(),
    updateWithMeta: vi.fn(),
};

const mockVariantRepo = {
    createBatch: vi.fn(),
    syncVariants: vi.fn(),
    findByProductId: vi.fn(),
};
const mockVariantImageRepo = {
    syncImages: vi.fn(),
};

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
    ProductRepository: class {
        create(...args) { return mockProductRepo.create(...args); }
        findBySpu(...args) { return mockProductRepo.findBySpu(...args); }
        search(...args) { return mockProductRepo.search(...args); }
        updateWithMeta(...args) { return mockProductRepo.updateWithMeta(...args); }
    },
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
    ProductVariantRepository: class {
        createBatch(...args) { return mockVariantRepo.createBatch(...args); }
        syncVariants(...args) { return mockVariantRepo.syncVariants(...args); }
        findByProductId(...args) { return mockVariantRepo.findByProductId(...args); }
    },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
    VariantImageRepository: class {
        syncImages(...args) { return mockVariantImageRepo.syncImages(...args); }
    },
}));

vi.mock('../../../../middleware/cache.js', () => ({
    withCache: () => async (_c, next) => await next(),
    invalidateCache: vi.fn(),
    getProductCacheUrls: vi.fn(() => []),
}));

function createApp() {
    const app = new Hono();
    app.onError((err, c) => c.json({ success: false, error: err.message }, err.statusCode || 500));
    app.route('/api/manage/products', productsApp);
    return app;
}

const validVariants = [
    {
        sku: 'SKU-001',
        price: 100,
        cost_price: 60,
        stock_quantity: 10,
        alert_threshold: 2,
        status: 'active',
        options_values: { Color: 'Red', Size: 'M' },
    },
];

describe('Product Routes — variant-first contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /', () => {
        it('requires variants for product creation', async () => {
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

            expect(res.status).toBe(400);
        });

        it('requires complete variant business fields', async () => {
            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test Product', variants: [{ sku: 'SKU-001', price: 100 }] }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(400);
        });

        it('creates product when name + variants are provided and spu omitted', async () => {
            mockProductRepo.create.mockResolvedValue({ id: 'test-id', name: 'Test Product', spu: null });
            mockVariantRepo.createBatch.mockResolvedValue([]);

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test Product', variants: validVariants }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
            expect(mockVariantRepo.createBatch).toHaveBeenCalledWith(
                'test-id',
                expect.arrayContaining([
                    expect.objectContaining({
                        sku: 'SKU-001',
                        price: 100,
                        cost_price: 60,
                        stock_quantity: 10,
                        alert_threshold: 2,
                        status: 'active',
                        options_values: { Color: 'Red', Size: 'M' },
                    }),
                ])
            );
        });

        it('returns 409 on duplicated non-empty spu', async () => {
            mockProductRepo.findBySpu.mockResolvedValue({ id: 'existing', spu: 'SPU-001' });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test', spu: 'SPU-001', variants: validVariants }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(409);
        });

        it('handles non-string spu safely', async () => {
            mockProductRepo.create.mockResolvedValue({ id: 'test-id', name: 'Test', spu: null });
            mockVariantRepo.createBatch.mockResolvedValue([]);

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test', spu: 123, variants: validVariants }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
        });

        it('syncs variant images even when input sku is empty', async () => {
            mockProductRepo.create.mockResolvedValue({ id: 'test-id', name: 'Test Product', spu: null });
            mockVariantRepo.createBatch.mockResolvedValue([
                {
                    id: 'v-generated',
                    sku: 'SKU-GENERATED',
                    options_values: { Color: 'Red', Size: 'M' },
                },
            ]);
            mockVariantImageRepo.syncImages.mockResolvedValue();

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: 'Test Product',
                        variants: [
                            {
                                sku: '',
                                price: 100,
                                cost_price: 60,
                                stock_quantity: 10,
                                alert_threshold: 2,
                                status: 'active',
                                options_values: { Color: 'Red', Size: 'M' },
                                images: [{ image_id: 'img-1', is_primary: 1 }],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
            expect(mockVariantImageRepo.syncImages).toHaveBeenCalledWith(
                'test-id',
                'v-generated',
                [{ image_id: 'img-1', is_primary: 1 }]
            );
        });

        it('rejects invalid currency code before repository create', async () => {
            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: 'Test Product',
                        currency: 'INVALID',
                        variants: validVariants,
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(400);
            expect(mockProductRepo.create).not.toHaveBeenCalled();
        });

        it('normalizes lowercase currency code to uppercase', async () => {
            mockProductRepo.create.mockResolvedValue({ id: 'test-id', name: 'Test Product', spu: null });
            mockVariantRepo.createBatch.mockResolvedValue([]);

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: 'Test Product',
                        currency: 'usd',
                        variants: validVariants,
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
            expect(mockProductRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ currency: 'USD' })
            );
        });
    });

    describe('POST /batch', () => {
        it('should upsert products and variants when found by spu', async () => {
            // Case A: findBySpu hits existing product -> updateWithMeta + syncVariants
            mockProductRepo.findBySpu.mockResolvedValue({ id: 'existing-id', spu: 'SPU-BATCH-1' });
            mockProductRepo.updateWithMeta.mockResolvedValue();
            mockVariantRepo.findByProductId.mockResolvedValue([
                { id: 'old-var', sku: 'OLD-SKU', options_values: { Color: 'Red' } }
            ]);
            mockVariantRepo.syncVariants.mockResolvedValue({ createdCount: 1, updatedCount: 1, deletedCount: 0 });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'Batch Prod 1',
                                spu: 'SPU-BATCH-1',
                                variants: validVariants
                            }
                        ]
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            
            // Should call update instead of create
            expect(mockProductRepo.updateWithMeta).toHaveBeenCalledWith('existing-id', expect.objectContaining({ name: 'Batch Prod 1' }));
            expect(mockProductRepo.create).not.toHaveBeenCalled();
            expect(mockVariantRepo.syncVariants).toHaveBeenCalled();
            
            expect(data.summary).toBeDefined();
            expect(data.summary.updatedProducts).toBe(1);
            expect(data.summary.createdProducts).toBe(0);
        });

        it('should create new products and variants when spu not found or empty', async () => {
            // Case B: findBySpu returns null -> create + syncVariants
            mockProductRepo.findBySpu.mockResolvedValue(null);
            mockProductRepo.create.mockResolvedValue({ id: 'new-id' });
            mockVariantRepo.findByProductId.mockResolvedValue([]);
            mockVariantRepo.syncVariants.mockResolvedValue({ createdCount: 1, updatedCount: 0, deletedCount: 0 });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'Batch Prod 2',
                                spu: 'SPU-BATCH-2',
                                variants: validVariants
                            }
                        ]
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            
            expect(mockProductRepo.findBySpu).toHaveBeenCalledWith('SPU-BATCH-2');
            expect(mockProductRepo.create).toHaveBeenCalled();
            expect(mockVariantRepo.syncVariants).toHaveBeenCalled();
            
            expect(data.summary).toBeDefined();
            expect(data.summary.createdProducts).toBe(1);
            expect(data.summary.createdVariants).toBe(1);
        });
    });
});
