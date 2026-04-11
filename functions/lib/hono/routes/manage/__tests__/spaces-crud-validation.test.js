import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  updateSharedSalespersons: vi.fn(),
  invalidateSpaceCaches: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  productFindById: vi.fn(),
  variantFindByIdAndProductId: vi.fn(),
}));

vi.mock('../../../../../repositories/SpaceRepository.js', () => ({
  SpaceRepository: vi.fn(() => ({
    create: mocks.create,
    findAll: mocks.findAll,
    findById: mocks.findById,
    update: mocks.update,
    updateSharedSalespersons: mocks.updateSharedSalespersons,
  })),
}));

vi.mock('../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: vi.fn(() => ({
    findById: mocks.productFindById,
  })),
}));

vi.mock('../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: vi.fn(() => ({
    findByIdAndProductId: mocks.variantFindByIdAndProductId,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => await next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
  invalidateCache: vi.fn(async () => {}),
}));

vi.mock('../spaces/cache-helpers.js', () => ({
  invalidateSpaceCaches: mocks.invalidateSpaceCaches,
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../_shared/route-helpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAllSalespersonAccessTokens: vi.fn(async () => []),
  };
});

import spacesCrud from '../spaces/crud.js';

const createApp = () => {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/spaces', spacesCrud);
  return app;
};

describe('manage spaces crud validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue(true);
    mocks.findAll.mockResolvedValue([]);
    mocks.findById.mockResolvedValue({
      id: 'sp-1',
      parent_id: null,
      product_id: null,
      variant_id: null,
    });
    mocks.update.mockResolvedValue({
      id: 'sp-1',
      share_token: 'token-1',
      share_mode: 'none',
      is_public: 0,
      password: null,
    });
    mocks.updateSharedSalespersons.mockResolvedValue(undefined);
    mocks.invalidateSpaceCaches.mockResolvedValue(undefined);
    mocks.scheduleAuditEvent.mockImplementation(() => {});
    mocks.productFindById.mockResolvedValue({ id: 'p-1', status: 'active' });
    mocks.variantFindByIdAndProductId.mockResolvedValue({ id: 'v-1', product_id: 'p-1', status: 'active' });
  });

  it('rejects create when productId is provided without variantId', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/spaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Space A',
          productId: 'p-1',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects patch when variantId is provided without productId', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/spaces/sp-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: 'v-1',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects create when bound product does not exist', async () => {
    mocks.productFindById.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/spaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Space A',
          productId: 'p-missing',
          variantId: 'v-1',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('productId does not exist');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects patch when variant does not belong to bound product', async () => {
    mocks.variantFindByIdAndProductId.mockResolvedValueOnce(null);
    mocks.findById.mockResolvedValueOnce({
      id: 'sp-1',
      parent_id: null,
      product_id: 'p-1',
      variant_id: 'v-1',
    });
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/spaces/sp-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'p-1',
          variantId: 'v-missing',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('variantId does not belong to productId');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('persists share mode and selected salespersons on create', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/spaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Space A',
          shareMode: 'selected',
          sharedSalespersonIds: ['sp-a', 'sp-b'],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shareMode: 'selected',
      })
    );
    expect(mocks.updateSharedSalespersons).toHaveBeenCalledWith(expect.any(String), ['sp-a', 'sp-b']);
  });

  it('excludes subspaces from the top-level spaces list', async () => {
    mocks.findAll.mockResolvedValueOnce([
      {
        id: 'space-parent-1',
        name: '顶级空间',
        parent_id: null,
        is_public: 1,
        share_mode: 'all',
        file_count: 1,
        view_count: 0,
      },
      {
        id: 'space-child-1',
        name: '子空间',
        parent_id: 'space-parent-1',
        is_public: 1,
        share_mode: 'all',
        file_count: 2,
        view_count: 0,
      },
    ]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/spaces',
      { method: 'GET' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      expect.objectContaining({
        id: 'space-parent-1',
        name: '顶级空间',
      }),
    ]);
  });
});
