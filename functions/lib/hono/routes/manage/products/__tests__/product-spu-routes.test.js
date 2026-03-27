import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productsApp from '../index.js';

const mockProductRepo = {
    create: vi.fn(),
    findById: vi.fn(),
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
const mockDimensionRepo = {
    createDimension: vi.fn(),
    addValue: vi.fn(),
    listByProduct: vi.fn(),
    updateDimension: vi.fn(),
    updateValueMeta: vi.fn(),
    restoreSnapshot: vi.fn(),
};
const mockFolderUtils = {
    ensureVariantFolder: vi.fn(),
    moveFilesToFolder: vi.fn(),
};

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
    ProductRepository: class {
        create(...args) { return mockProductRepo.create(...args); }
        findById(...args) { return mockProductRepo.findById(...args); }
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

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
    ProductDimensionRepository: class {
        listByProduct(...args) { return mockDimensionRepo.listByProduct(...args); }
        createDimension(...args) { return mockDimensionRepo.createDimension(...args); }
        addValue(...args) { return mockDimensionRepo.addValue(...args); }
        updateDimension(...args) { return mockDimensionRepo.updateDimension(...args); }
        updateValueMeta(...args) { return mockDimensionRepo.updateValueMeta(...args); }
        restoreSnapshot(...args) { return mockDimensionRepo.restoreSnapshot(...args); }
    },
}));

vi.mock('../../../../../../api/utils/folder-utils.js', () => ({
    ensureVariantFolder: (...args) => mockFolderUtils.ensureVariantFolder(...args),
    moveFilesToFolder: (...args) => mockFolderUtils.moveFilesToFolder(...args),
}));

vi.mock('../../../../middleware/cache.js', () => ({
    withCache: () => async (_c, next) => await next(),
    invalidateCache: vi.fn(),
    getProductCacheUrls: vi.fn(() => []),
}));

function createApp() {
    const app = new Hono();
    app.onError((err, c) => c.json({ success: false, error: err.message }, err.statusCode || 500));
    app.use('/api/manage/products/*', async (c, next) => {
        c.set('user', { id: 'u-manager', type: 'user', role: 'manager', permissions: [] });
        await next();
    });
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
        mockProductRepo.findById.mockResolvedValue(null);
        mockDimensionRepo.createDimension.mockResolvedValue({ id: 'dim-color', name: 'Color' });
        mockDimensionRepo.addValue.mockResolvedValue({ id: 'val-red', value: 'Red' });
        mockDimensionRepo.listByProduct.mockResolvedValue([]);
        mockDimensionRepo.updateDimension.mockResolvedValue({ id: 'dim-color', name: 'Color' });
        mockDimensionRepo.updateValueMeta.mockResolvedValue(undefined);
        mockDimensionRepo.restoreSnapshot.mockResolvedValue(undefined);
        mockFolderUtils.ensureVariantFolder.mockResolvedValue('folder-variant');
        mockFolderUtils.moveFilesToFolder.mockResolvedValue(undefined);
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

        it('rejects variant image sync payload when input sku is empty', async () => {
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

            expect(res.status).toBe(400);
            expect(mockVariantImageRepo.syncImages).not.toHaveBeenCalled();
        });

        it('persists dimension value meta when creating product', async () => {
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
                        variants: validVariants,
                        dimensions: [
                            {
                                name: 'Color',
                                values: [{ value: 'Red', meta: { hex: '#ff0000' } }],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(201);
            expect(mockDimensionRepo.addValue).toHaveBeenCalledWith(
                'test-id',
                'dim-color',
                expect.objectContaining({
                    value: 'Red',
                    sort_order: 0,
                    meta: { hex: '#ff0000' },
                })
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
        it('delegates batch orchestration to ProductCatalogService instead of route-local rollback branches', () => {
            const routePath = path.resolve(process.cwd(), 'functions/lib/hono/routes/manage/products/batch.js');
            const source = fs.readFileSync(routePath, 'utf8');

            expect(source).toContain('ProductCatalogService');
            expect(source).toContain('batchImport');
            expect(source).not.toContain('rollbackProductId');
            expect(source).not.toContain('rollbackProductPayload');
        });

        it('should reject item when product name is empty', async () => {
            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: '   ',
                                spu: 'SPU-EMPTY-NAME',
                                variants: validVariants,
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.summary.failedProducts).toBe(1);
            expect(data.errors[0]).toContain('name is required');
            expect(mockProductRepo.create).not.toHaveBeenCalled();
            expect(mockProductRepo.updateWithMeta).not.toHaveBeenCalled();
        });

        it('should reject item when any variant sku is empty', async () => {
            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'Batch Prod Invalid SKU',
                                spu: 'SPU-INVALID-SKU',
                                variants: [
                                    { ...validVariants[0], sku: '  ' },
                                ],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.summary.failedProducts).toBe(1);
            expect(data.errors[0]).toContain('variant #1 sku is required');
            expect(mockVariantRepo.syncVariants).not.toHaveBeenCalled();
        });

        it('should reject invalid currency and negative variant values before any repository write', async () => {
            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'Batch Prod Invalid Payload',
                                spu: 'SPU-INVALID-PAYLOAD',
                                currency: 'INVALID',
                                variants: [{ ...validVariants[0], price: -1 }],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.summary.failedProducts).toBe(1);
            expect(mockProductRepo.create).not.toHaveBeenCalled();
            expect(mockProductRepo.updateWithMeta).not.toHaveBeenCalled();
            expect(mockVariantRepo.syncVariants).not.toHaveBeenCalled();
        });

        it('should trim name and sku before repository operations', async () => {
            mockProductRepo.findBySpu.mockResolvedValue(null);
            mockProductRepo.create.mockResolvedValue({ id: 'new-trim-id' });
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
                                name: '  Batch Prod Trim  ',
                                spu: 'SPU-BATCH-TRIM',
                                variants: [
                                    { ...validVariants[0], sku: '  SKU-TRIM-001  ' },
                                ],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(mockProductRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Batch Prod Trim',
                })
            );
            expect(mockVariantRepo.syncVariants).toHaveBeenCalledWith(
                'new-trim-id',
                expect.arrayContaining([
                    expect.objectContaining({
                        sku: 'SKU-TRIM-001',
                    }),
                ])
            );
        });

        it('should reject item when duplicate variant sku exists within same product', async () => {
            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'Batch Prod Duplicate SKU',
                                spu: 'SPU-DUP-SKU',
                                variants: [
                                    { ...validVariants[0], sku: 'DUP-SKU-001' },
                                    { ...validVariants[0], sku: ' DUP-SKU-001 ' },
                                ],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.summary.failedProducts).toBe(1);
            expect(data.errors[0]).toContain('variant sku duplicated');
            expect(mockProductRepo.create).not.toHaveBeenCalled();
            expect(mockProductRepo.updateWithMeta).not.toHaveBeenCalled();
            expect(mockVariantRepo.syncVariants).not.toHaveBeenCalled();
        });

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

        it('should sync dimensions and normalize variant option keys during batch create', async () => {
            mockProductRepo.findBySpu.mockResolvedValue(null);
            mockProductRepo.create.mockResolvedValue({ id: 'new-id' });
            mockVariantRepo.findByProductId.mockResolvedValue([]);
            mockVariantRepo.syncVariants.mockResolvedValue({ createdCount: 1, updatedCount: 0, deletedCount: 0 });
            mockDimensionRepo.listByProduct
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                    {
                        id: 'dim-color',
                        name: 'Color',
                        values: [{ id: 'val-red', value: 'Red' }],
                    },
                ]);

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'Batch Prod With Dimensions',
                                spu: 'SPU-BATCH-DIM',
                                dimensions: [
                                    {
                                        name: 'Color',
                                        values: [{ value: 'Red' }],
                                    },
                                ],
                                variants: [
                                    {
                                        ...validVariants[0],
                                        sku: 'SKU-DIM-1',
                                        options_values: { Color: 'Red' },
                                    },
                                ],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            expect(mockDimensionRepo.createDimension).toHaveBeenCalledWith(
                'new-id',
                expect.objectContaining({ name: 'Color' })
            );
            expect(mockVariantRepo.syncVariants).toHaveBeenCalledWith(
                'new-id',
                expect.arrayContaining([
                    expect.objectContaining({
                        sku: 'SKU-DIM-1',
                        options_values: { 'dim-color': 'Red' },
                    }),
                ])
            );
        });

        it('should continue processing when one item fails and keep partial success', async () => {
            mockProductRepo.findBySpu.mockResolvedValue(null);
            mockProductRepo.create
                .mockResolvedValueOnce({ id: 'ok-id' })
                .mockRejectedValueOnce(new Error('UNIQUE constraint failed: product_variants.barcode'));
            mockVariantRepo.findByProductId.mockResolvedValue([]);
            mockVariantRepo.syncVariants.mockResolvedValue([]);

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            { name: 'OK Product', spu: 'SPU-OK', variants: validVariants },
                            { name: 'Bad Product', spu: 'SPU-BAD', variants: validVariants },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.summary.createdProducts).toBe(1);
            expect(data.summary.failedProducts).toBe(1);
            expect(Array.isArray(data.errors)).toBe(true);
            expect(data.errors[0]).toContain('SPU-BAD');
        });

        it('should compute fallback variant stats when syncVariants does not return created/updated counters', async () => {
            mockProductRepo.findBySpu.mockResolvedValue({ id: 'existing-id', spu: 'SPU-BATCH-3' });
            mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
            mockVariantRepo.findByProductId.mockResolvedValue([
                { id: 'var-1', sku: 'SKU-001', options_values: { Color: 'Red', Size: 'M' } },
            ]);
            mockVariantRepo.syncVariants.mockResolvedValue([
                { id: 'var-1', sku: 'SKU-001' }, // updated
                { id: 'var-new', sku: 'SKU-NEW' }, // created
            ]);

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'Batch Prod 3',
                                spu: 'SPU-BATCH-3',
                                variants: [
                                    { ...validVariants[0], sku: 'SKU-001' },
                                    { ...validVariants[0], sku: 'SKU-NEW', variant_code: 'V-NEW' },
                                ],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.summary.updatedProducts).toBe(1);
            expect(data.summary.updatedVariants).toBe(1);
            expect(data.summary.createdVariants).toBe(1);
        });

        it('should keep conflicting fields unchanged in safe_merge mode and return conflicts', async () => {
            mockProductRepo.findBySpu.mockResolvedValue({
                id: 'existing-id',
                spu: 'SPU-SAFE-1',
                name: 'Old Name',
                brand: 'Old Brand',
            });
            mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
            mockVariantRepo.findByProductId.mockResolvedValue([
                {
                    id: 'var-safe-1',
                    sku: 'SKU-SAFE-1',
                    price: 100,
                    options_values: { Color: 'Red' },
                },
            ]);
            mockVariantRepo.syncVariants.mockResolvedValue({ createdCount: 0, updatedCount: 1, deletedCount: 0 });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        import_mode: 'safe_merge',
                        items: [
                            {
                                name: 'New Name',
                                brand: 'New Brand',
                                spu: 'SPU-SAFE-1',
                                variants: [
                                    { ...validVariants[0], sku: 'SKU-SAFE-1', price: 120 },
                                ],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.importMode).toBe('safe_merge');
            expect(data.summary.conflicts).toBeGreaterThanOrEqual(2);
            expect(Array.isArray(data.conflicts)).toBe(true);
            expect(mockProductRepo.updateWithMeta).toHaveBeenCalledWith(
                'existing-id',
                expect.not.objectContaining({ name: 'New Name', brand: 'New Brand' })
            );
            expect(mockVariantRepo.syncVariants).toHaveBeenCalledWith(
                'existing-id',
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'var-safe-1',
                        sku: 'SKU-SAFE-1',
                        price: 100,
                    }),
                ])
            );
        });

        it('should overwrite fields in replace mode', async () => {
            mockProductRepo.findBySpu.mockResolvedValue({
                id: 'existing-id',
                spu: 'SPU-REPLACE-1',
                name: 'Old Name',
            });
            mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
            mockVariantRepo.findByProductId.mockResolvedValue([
                {
                    id: 'var-replace-1',
                    sku: 'SKU-REPLACE-1',
                    price: 100,
                    options_values: { Color: 'Red' },
                },
                {
                    id: 'var-stale-2',
                    sku: 'SKU-STALE-2',
                    price: 90,
                    options_values: { Color: 'Blue' },
                },
            ]);
            mockVariantRepo.syncVariants.mockResolvedValue({ createdCount: 0, updatedCount: 1, archivedCount: 1, deletedCount: 1 });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        import_mode: 'replace',
                        items: [
                            {
                                name: 'New Name',
                                spu: 'SPU-REPLACE-1',
                                variants: [
                                    { ...validVariants[0], sku: 'SKU-REPLACE-1', price: 120 },
                                ],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.importMode).toBe('replace');
            expect(data.summary.conflicts).toBe(0);
            expect(mockProductRepo.updateWithMeta).toHaveBeenCalledWith(
                'existing-id',
                expect.objectContaining({ name: 'New Name' })
            );
            expect(mockVariantRepo.syncVariants).toHaveBeenCalledWith(
                'existing-id',
                [
                    expect.objectContaining({
                        id: 'var-replace-1',
                        price: 120,
                    }),
                ]
            );
            expect(data.summary.archivedVariants).toBe(1);
        });

        it('should mark item as failed when updateWithMeta returns unsuccessful result', async () => {
            mockProductRepo.findBySpu.mockResolvedValue({
                id: 'existing-id',
                spu: 'SPU-UPD-FAIL-1',
                name: 'Old Name',
            });
            mockProductRepo.updateWithMeta.mockResolvedValue({ success: false, changes: 0, error: 'Invalid currency code' });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'New Name',
                                spu: 'SPU-UPD-FAIL-1',
                                currency: 'INVALID',
                                variants: [
                                    { ...validVariants[0], sku: 'SKU-UPD-FAIL-1', variant_code: 'V-UPD-FAIL-1' },
                                ],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.summary.updatedProducts).toBe(0);
            expect(data.summary.failedProducts).toBe(1);
            expect(mockVariantRepo.syncVariants).not.toHaveBeenCalled();
            expect(data.errors[0]).toContain('Invalid currency code');
        });

        it('should rollback newly created product when variant sync fails', async () => {
            mockProductRepo.findBySpu.mockResolvedValue(null);
            mockProductRepo.create.mockResolvedValue({ id: 'new-created-id' });
            mockVariantRepo.findByProductId.mockResolvedValue([]);
            mockVariantRepo.syncVariants.mockRejectedValue(new Error('duplicate variant signature in payload'));
            const runDelete = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
            const bindDelete = vi.fn(() => ({ run: runDelete }));
            const prepare = vi.fn(() => ({ bind: bindDelete }));

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'Rollback Product',
                                spu: 'SPU-ROLLBACK-1',
                                variants: [{ ...validVariants[0], sku: 'SKU-ROLLBACK-1' }],
                            },
                        ],
                    }),
                },
                { DB: { prepare }, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.summary.createdProducts).toBe(0);
            expect(data.summary.failedProducts).toBe(1);
            expect(prepare).toHaveBeenCalledWith('DELETE FROM products WHERE id = ?');
            expect(bindDelete).toHaveBeenCalledWith('new-created-id');
            expect(runDelete).toHaveBeenCalled();
        });

        it('should rollback existing product updates when variant sync fails', async () => {
            mockProductRepo.findBySpu.mockResolvedValue({
                id: 'existing-id',
                spu: 'SPU-ROLLBACK-UPD',
                name: 'Old Name',
                brand: 'Old Brand',
                currency: 'CNY',
                images: [],
                specifications: {},
                options: [],
            });
            mockProductRepo.findById.mockResolvedValue({
                id: 'existing-id',
                spu: 'SPU-ROLLBACK-UPD',
                name: 'Old Name',
                brand: 'Old Brand',
                currency: 'CNY',
                images: [],
                specifications: {},
                options: [],
            });
            mockDimensionRepo.listByProduct.mockResolvedValue([
                {
                    id: 'dim-color',
                    name: 'Color',
                    values: [{ id: 'val-red', value: 'Red', status: 'active' }],
                    aliases: [],
                },
            ]);
            mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
            mockVariantRepo.findByProductId.mockResolvedValue([
                { id: 'var-old', sku: 'SKU-OLD', price: 100, cost_price: 60, alert_threshold: 2, status: 'active', options_values: { Color: 'Red' } },
            ]);
            mockVariantRepo.syncVariants.mockRejectedValueOnce(new Error('duplicate variant signature in payload'));
            mockVariantRepo.syncVariants.mockResolvedValueOnce({ createdCount: 0, updatedCount: 1, archivedCount: 0, reactivatedCount: 0 });

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            {
                                name: 'New Name',
                                brand: 'New Brand',
                                spu: 'SPU-ROLLBACK-UPD',
                                variants: [{ ...validVariants[0], sku: 'SKU-NEW' }],
                            },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.summary.updatedProducts).toBe(0);
            expect(data.summary.failedProducts).toBe(1);
            expect(mockProductRepo.updateWithMeta).toHaveBeenCalledTimes(2);
            expect(mockProductRepo.updateWithMeta).toHaveBeenLastCalledWith(
                'existing-id',
                expect.objectContaining({
                    name: 'Old Name',
                    brand: 'Old Brand',
                    currency: 'CNY',
                })
            );
            expect(mockVariantRepo.syncVariants).toHaveBeenCalledTimes(2);
            expect(mockVariantRepo.syncVariants).toHaveBeenLastCalledWith(
                'existing-id',
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'var-old',
                        sku: 'SKU-OLD',
                        options_values: { Color: 'Red' },
                    }),
                ])
            );
            expect(mockDimensionRepo.restoreSnapshot).toHaveBeenCalledWith(
                'existing-id',
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'dim-color',
                        name: 'Color',
                    }),
                ])
            );
        });

        it('should return success=false when all items fail', async () => {
            mockProductRepo.findBySpu.mockResolvedValue(null);
            mockProductRepo.create.mockRejectedValue(new Error('boom'));

            const app = createApp();
            const res = await app.request(
                'http://localhost/api/manage/products/batch',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [
                            { name: 'Fail 1', spu: 'SPU-F1', variants: validVariants },
                            { name: 'Fail 2', spu: 'SPU-F2', variants: validVariants },
                        ],
                    }),
                },
                { DB: {}, executionCtx: { waitUntil: vi.fn() } },
                { waitUntil: vi.fn() }
            );

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.count).toBe(0);
            expect(data.summary.failedProducts).toBe(2);
            expect(data.errors).toHaveLength(2);
        });
    });
});
