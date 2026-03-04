import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productsIndexApp from '../index.js';
import productsDetailApp from '../[id].js';

const mockProductRepo = {
    findById: vi.fn(),
};

const mockVariantImageRepo = {
    addImage: vi.fn(),
    sortImages: vi.fn(),
    setPrimary: vi.fn(),
    deleteImage: vi.fn(),
};

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
    ProductRepository: class {
        constructor() {}
        findById(...args) {
            return mockProductRepo.findById(...args);
        }
    },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
    VariantImageRepository: class {
        constructor() {}
        addImage(...args) {
            return mockVariantImageRepo.addImage(...args);
        }
        sortImages(...args) {
            return mockVariantImageRepo.sortImages(...args);
        }
        setPrimary(...args) {
            return mockVariantImageRepo.setPrimary(...args);
        }
        deleteImage(...args) {
            return mockVariantImageRepo.deleteImage(...args);
        }
    },
}));

vi.mock('../../../../middleware/cache.js', () => ({
    withCache: () => async (_c, next) => await next(),
    invalidateCache: vi.fn(async () => {}),
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
    app.use('/api/manage/products/*', async (c, next) => {
        c.set('user', { id: 'u-manager', type: 'user', role: 'manager', permissions: [] });
        await next();
    });
    app.route('/api/manage/products', productsIndexApp);
    app.route('/api/manage/products', productsDetailApp);
    return app;
}

function requestContext() {
    return {
        env: { DB: {} },
        executionCtx: { waitUntil: vi.fn() },
    };
}

describe('variant image management routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockProductRepo.findById.mockResolvedValue({ id: 'prod_1' });
        mockVariantImageRepo.addImage.mockResolvedValue({ id: 'vi_1', image_id: 'file_1' });
        mockVariantImageRepo.sortImages.mockResolvedValue(undefined);
        mockVariantImageRepo.setPrimary.mockResolvedValue(undefined);
        mockVariantImageRepo.deleteImage.mockResolvedValue(true);
    });

    it('POST /:id/variants/:variantId/images adds variant image', async () => {
        const app = createApp();
        const { env, executionCtx } = requestContext();

        const res = await app.request(
            'http://localhost/api/manage/products/prod_1/variants/var_1/images',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageId: 'file_1' }),
            },
            env,
            executionCtx
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(mockVariantImageRepo.addImage).toHaveBeenCalledWith({
            productId: 'prod_1',
            variantId: 'var_1',
            imageId: 'file_1',
            isPrimary: false,
        });
    });

    it('PATCH /:id/variants/:variantId/images/sort sorts images', async () => {
        const app = createApp();
        const { env, executionCtx } = requestContext();

        const res = await app.request(
            'http://localhost/api/manage/products/prod_1/variants/var_1/images/sort',
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageIds: ['file_2', 'file_1'] }),
            },
            env,
            executionCtx
        );

        expect(res.status).toBe(200);
        expect(mockVariantImageRepo.sortImages).toHaveBeenCalledWith({
            productId: 'prod_1',
            variantId: 'var_1',
            imageIds: ['file_2', 'file_1'],
        });
    });

    it('PATCH /:id/variants/:variantId/images/:imageId/primary sets primary', async () => {
        const app = createApp();
        const { env, executionCtx } = requestContext();

        const res = await app.request(
            'http://localhost/api/manage/products/prod_1/variants/var_1/images/file_2/primary',
            { method: 'PATCH' },
            env,
            executionCtx
        );

        expect(res.status).toBe(200);
        expect(mockVariantImageRepo.setPrimary).toHaveBeenCalledWith({
            productId: 'prod_1',
            variantId: 'var_1',
            imageId: 'file_2',
        });
    });

    it('DELETE /:id/variants/:variantId/images/:imageId deletes image', async () => {
        const app = createApp();
        const { env, executionCtx } = requestContext();

        const res = await app.request(
            'http://localhost/api/manage/products/prod_1/variants/var_1/images/file_2',
            { method: 'DELETE' },
            env,
            executionCtx
        );

        expect(res.status).toBe(200);
        expect(mockVariantImageRepo.deleteImage).toHaveBeenCalledWith({
            productId: 'prod_1',
            variantId: 'var_1',
            imageId: 'file_2',
        });
    });

    it('returns bad request for cross-product variant ownership mismatch', async () => {
        const app = createApp();
        const { env, executionCtx } = requestContext();
        mockVariantImageRepo.addImage.mockRejectedValue(new Error('Variant does not belong to product'));

        const res = await app.request(
            'http://localhost/api/manage/products/prod_1/variants/var_2/images',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageId: 'file_1' }),
            },
            env,
            executionCtx
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Variant does not belong to product');
    });
});
