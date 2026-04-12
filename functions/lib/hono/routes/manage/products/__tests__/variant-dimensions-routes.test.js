import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productsDetailApp from '../[id].js';

const mockProductRepo = {
    findById: vi.fn(),
};

const mockVariantRepo = {
    findByProductId: vi.fn(),
};

const mockVariantImageRepo = {
    listByVariant: vi.fn(),
};

const mockDimensionRepo = {
    listByProduct: vi.fn(),
    getDimensionMap: vi.fn(),
    createDimension: vi.fn(),
    updateDimension: vi.fn(),
    archiveDimension: vi.fn(),
    addValue: vi.fn(),
    archiveValue: vi.fn(),
    restoreValue: vi.fn(),
    getImpactPreview: vi.fn(),
    archiveVariantsByDimension: vi.fn(),
    archiveVariantsByValue: vi.fn(),
    mergeKeepByDimensionRemoval: vi.fn(),
};
const mockScheduleProductCacheInvalidation = vi.fn(async () => []);

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
    ProductRepository: class {
        findById(...args) {
            return mockProductRepo.findById(...args);
        }
        updateWithMeta() {
            return { success: true, changes: 1 };
        }
        update() {
            return true;
        }
    },
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
    ProductVariantRepository: class {
        findByProductId(...args) {
            return mockVariantRepo.findByProductId(...args);
        }
        syncVariants() {
            return [];
        }
        buildAuditEvents() {
            return [];
        }
    },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
    VariantImageRepository: class {
        listByVariant(...args) {
            return mockVariantImageRepo.listByVariant(...args);
        }
    },
}));

vi.mock('../../../../../../repositories/VariantAuditRepository.js', () => ({
    VariantAuditRepository: class {
        createBatch() {
            return [];
        }
    },
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
    ProductDimensionRepository: class {
        listByProduct(...args) {
            return mockDimensionRepo.listByProduct(...args);
        }
        getDimensionMap(...args) {
            return mockDimensionRepo.getDimensionMap(...args);
        }
        createDimension(...args) {
            return mockDimensionRepo.createDimension(...args);
        }
        updateDimension(...args) {
            return mockDimensionRepo.updateDimension(...args);
        }
        archiveDimension(...args) {
            return mockDimensionRepo.archiveDimension(...args);
        }
        addValue(...args) {
            return mockDimensionRepo.addValue(...args);
        }
        archiveValue(...args) {
            return mockDimensionRepo.archiveValue(...args);
        }
        restoreValue(...args) {
            return mockDimensionRepo.restoreValue(...args);
        }
        getImpactPreview(...args) {
            return mockDimensionRepo.getImpactPreview(...args);
        }
        archiveVariantsByDimension(...args) {
            return mockDimensionRepo.archiveVariantsByDimension(...args);
        }
        archiveVariantsByValue(...args) {
            return mockDimensionRepo.archiveVariantsByValue(...args);
        }
        mergeKeepByDimensionRemoval(...args) {
            return mockDimensionRepo.mergeKeepByDimensionRemoval(...args);
        }
    },
}));

vi.mock('../../../../middleware/cache.js', () => ({
    invalidateCache: vi.fn(),
    getProductCacheUrls: vi.fn(() => []),
}));

vi.mock('../../../../middleware/auth.js', () => ({
    requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../cache-helpers.js', () => ({
    scheduleProductCacheInvalidation: (...args) => mockScheduleProductCacheInvalidation(...args),
}));

function createApp() {
    const app = new Hono();
    app.onError((err, c) => c.json({ success: false, error: err.message }, err.statusCode || 500));
    app.use('/api/manage/products/*', async (c, next) => {
        c.set('user', { id: 'u-manager', type: 'user', role: 'manager', permissions: ['products:manage'] });
        await next();
    });
    app.route('/api/manage/products', productsDetailApp);
    return app;
}

describe('variant dimensions routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockProductRepo.findById.mockResolvedValue({ id: 'prod-1', name: 'Tee' });
        mockVariantRepo.findByProductId.mockResolvedValue([]);
        mockVariantImageRepo.listByVariant.mockResolvedValue([]);
        mockScheduleProductCacheInvalidation.mockResolvedValue([]);
        mockDimensionRepo.listByProduct.mockResolvedValue([
            { id: 'dim-color', name: 'Color', status: 'active', values: [] },
        ]);
        mockDimensionRepo.getDimensionMap.mockResolvedValue({ 'dim-color': 'Color' });
        mockDimensionRepo.createDimension.mockResolvedValue({ id: 'dim-size', name: 'Size', status: 'active' });
        mockDimensionRepo.updateDimension.mockResolvedValue({ id: 'dim-color', name: 'Colour', status: 'active' });
        mockDimensionRepo.archiveDimension.mockResolvedValue({ id: 'dim-color', status: 'archived' });
        mockDimensionRepo.addValue.mockResolvedValue({ id: 'val-red', value: 'Red', status: 'active' });
        mockDimensionRepo.archiveValue.mockResolvedValue({ id: 'val-red', status: 'archived' });
        mockDimensionRepo.restoreValue.mockResolvedValue({ id: 'val-red', status: 'active' });
        mockDimensionRepo.getImpactPreview.mockResolvedValue({ affectedVariantsCount: 2, sampleVariants: [{ id: 'v1' }] });
        mockDimensionRepo.archiveVariantsByDimension.mockResolvedValue(2);
        mockDimensionRepo.archiveVariantsByValue.mockResolvedValue({ changes: 1, dimensionId: 'dim-color', value: 'Red' });
        mockDimensionRepo.mergeKeepByDimensionRemoval.mockResolvedValue({ deduped: 1, updated: 2 });
    });

    it('GET /:id returns dimensions and dimension_map', async () => {
        const app = createApp();
        const res = await app.request('http://localhost/api/manage/products/prod-1', {}, { DB: {} }, { waitUntil: vi.fn() });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.dimensions).toHaveLength(1);
        expect(body.data.dimension_map['dim-color']).toBe('Color');
    });

    it('POST /:id/dimensions creates a dimension', async () => {
        const app = createApp();
        const res = await app.request(
            'http://localhost/api/manage/products/prod-1/dimensions',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Size' }),
            },
            { DB: {} },
            { waitUntil: vi.fn() }
        );
        expect(res.status).toBe(201);
        expect(mockDimensionRepo.createDimension).toHaveBeenCalledWith('prod-1', { name: 'Size' });
    });

    it('PATCH /:id/dimensions/:dimensionId/archive supports merge_keep mode', async () => {
        const app = createApp();
        const res = await app.request(
            'http://localhost/api/manage/products/prod-1/dimensions/dim-color/archive',
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'merge_keep' }),
            },
            { DB: {} },
            { waitUntil: vi.fn() }
        );
        expect(res.status).toBe(200);
        expect(mockDimensionRepo.mergeKeepByDimensionRemoval).toHaveBeenCalledWith('prod-1', 'dim-color');
        expect(mockDimensionRepo.archiveDimension).toHaveBeenCalledWith('prod-1', 'dim-color');
    });

    it('POST /:id/dimensions/impact returns impact preview', async () => {
        const app = createApp();
        const payload = { action: 'archive_dimension', dimensionId: 'dim-color' };
        const res = await app.request(
            'http://localhost/api/manage/products/prod-1/dimensions/impact',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            },
            { DB: {} },
            { waitUntil: vi.fn() }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.affectedVariantsCount).toBe(2);
    });

    it('PATCH /:id/values/:valueId/archive archives variants and value', async () => {
        const app = createApp();
        const res = await app.request(
            'http://localhost/api/manage/products/prod-1/values/val-red/archive',
            { method: 'PATCH' },
            { DB: {} },
            { waitUntil: vi.fn() }
        );
        expect(res.status).toBe(200);
        expect(mockDimensionRepo.archiveVariantsByValue).toHaveBeenCalledWith('prod-1', 'val-red');
        expect(mockDimensionRepo.archiveValue).toHaveBeenCalledWith('prod-1', 'val-red');
    });
});
