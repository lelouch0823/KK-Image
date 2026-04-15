import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  createSubspace: vi.fn(),
  updateSharedSalespersons: vi.fn(),
  invalidateSpaceCaches: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  validateProductVariantBinding: vi.fn(),
}));

vi.mock('../../../../../../repositories/SpaceRepository.js', () => ({
  SpaceRepository: vi.fn(() => ({
    findById: mocks.findById,
    findSubspaces: vi.fn(async () => []),
    createSubspace: mocks.createSubspace,
    updateSharedSalespersons: mocks.updateSharedSalespersons,
  })),
}));

vi.mock('../../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../cache-helpers.js', () => ({
  invalidateSpaceCaches: mocks.invalidateSpaceCaches,
}));

vi.mock('../../../../../../_shared/utils.js', () => ({
  generateId: vi.fn(() => 'space-child-1'),
  generateShareToken: vi.fn(() => 'share-space'),
  getShareUrl: vi.fn(() => 'https://share/space'),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../../api/utils/validation.js', () => ({
  validateProductVariantBinding: mocks.validateProductVariantBinding,
}));

import subspacesApp from '../subspaces.js';

const createApp = () => {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/spaces/:id/subspaces', subspacesApp);
  return app;
};

describe('manage subspaces routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({ id: 'space-parent-1', product_id: 'product-1' });
    mocks.createSubspace.mockResolvedValue(undefined);
    mocks.updateSharedSalespersons.mockResolvedValue(undefined);
    mocks.invalidateSpaceCaches.mockImplementation(() => {});
    mocks.validateProductVariantBinding.mockImplementation(async (_db, productId, variantId, options = {}) => {
      if (productId && !variantId) {
        const error = new Error('variantId is required when productId is provided');
        error.statusCode = 400;
        throw error;
      }
      if (options.checkActive && productId === 'product-archived') {
        const error = new Error('product must be active');
        error.statusCode = 400;
        throw error;
      }
      if (options.checkActive && variantId === 'variant-archived') {
        const error = new Error('variant must be active');
        error.statusCode = 400;
        throw error;
      }
      if (options.variantSelectPolicy === 'in_stock_only' && variantId === 'variant-oos') {
        const error = new Error('variant must be in stock');
        error.statusCode = 400;
        throw error;
      }
      if (!productId && !variantId) {
        return { normalizedProductId: null, normalizedVariantId: null };
      }
      return {
        normalizedProductId: productId,
        normalizedVariantId: variantId,
      };
    });
  });

  it('audits subspace creation with parent metadata', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/spaces/space-parent-1/subspaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ' Child Space ', description: ' desc ', templateData: {} }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'space.subspace.create',
        targetId: 'space-child-1',
        target_label: 'Child Space',
        metadata: expect.objectContaining({ parentId: 'space-parent-1' }),
      })
    );
  });

  it('persists and audits product binding when creating a subspace', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/spaces/space-parent-1/subspaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Child Product Space',
          productId: 'product-2',
          variantId: 'variant-2',
          templateData: {},
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.validateProductVariantBinding).toHaveBeenCalledWith(
      {},
      'product-2',
      'variant-2',
      expect.objectContaining({
        variantSelectPolicy: 'in_stock_only',
      })
    );
    expect(mocks.createSubspace).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-2',
        variantId: 'variant-2',
      })
    );
    expect(mocks.invalidateSpaceCaches).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productIds: ['product-1', 'product-2'],
      })
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          parentId: 'space-parent-1',
          productId: 'product-2',
          variantId: 'variant-2',
        }),
      })
    );
  });

  it('rejects subspace creation when productId is provided without variantId', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/spaces/space-parent-1/subspaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Broken Child Space',
          productId: 'product-2',
          templateData: {},
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.createSubspace).not.toHaveBeenCalled();
  });

  it('rejects subspace creation when rebinding to an out-of-stock variant', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/spaces/space-parent-1/subspaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Out Of Stock Child Space',
          productId: 'product-2',
          variantId: 'variant-oos',
          templateData: {},
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.validateProductVariantBinding).toHaveBeenCalledWith(
      {},
      'product-2',
      'variant-oos',
      expect.objectContaining({
        variantSelectPolicy: 'in_stock_only',
      })
    );
    expect(mocks.createSubspace).not.toHaveBeenCalled();
  });

  it('rejects subspace creation when rebinding to an archived variant', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/spaces/space-parent-1/subspaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Archived Child Space',
          productId: 'product-2',
          variantId: 'variant-archived',
          templateData: {},
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.validateProductVariantBinding).toHaveBeenCalledWith(
      {},
      'product-2',
      'variant-archived',
      expect.objectContaining({
        checkActive: true,
        variantSelectPolicy: 'in_stock_only',
      })
    );
    expect(mocks.createSubspace).not.toHaveBeenCalled();
  });

  it('persists share mode and selected salespersons on subspace create', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/spaces/space-parent-1/subspaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Visible Child Space',
          shareMode: 'selected',
          sharedSalespersonIds: ['sp-a', 'sp-b'],
          templateData: {},
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.createSubspace).toHaveBeenCalledWith(
      expect.objectContaining({
        shareMode: 'selected',
      })
    );
    expect(mocks.updateSharedSalespersons).toHaveBeenCalledWith('space-child-1', ['sp-a', 'sp-b']);
  });
});
