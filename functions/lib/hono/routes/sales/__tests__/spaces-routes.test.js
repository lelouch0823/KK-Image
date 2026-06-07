import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findAllForSalesperson: vi.fn(),
  findByIdForSalesperson: vi.fn(),
  findSubspacesForSalesperson: vi.fn(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
}));

vi.mock('../../../../../repositories/SpaceRepository.js', () => ({
  SpaceRepository: vi.fn(() => ({
    findAllForSalesperson: mocks.findAllForSalesperson,
    findByIdForSalesperson: mocks.findByIdForSalesperson,
    findSubspacesForSalesperson: mocks.findSubspacesForSalesperson,
  })),
}));

import spacesApp from '../spaces.js';

const createApp = () => {
  const app = new Hono();
  app.use('/api/sales/:token/spaces/*', async (c, next) => {
    c.set('salesperson', { id: 'sp-1', name: 'Alice' });
    await next();
  });
  app.route('/api/sales/:token/spaces', spacesApp);
  return app;
};

describe('sales spaces routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAllForSalesperson.mockResolvedValue([]);
    mocks.findSubspacesForSalesperson.mockResolvedValue([]);
  });

  it('returns visible subspaces for collection space detail', async () => {
    mocks.findByIdForSalesperson.mockResolvedValue({
      id: 'space-parent-1',
      name: '合集空间',
      template: 'collection',
      template_data: '{}',
      files: [],
    });
    mocks.findSubspacesForSalesperson.mockResolvedValue([
      {
        id: 'sub-1',
        name: '子空间 1',
        template: 'gallery',
        share_token: 'sub-share-1',
        file_count: 3,
        cover_storage_key: 'covers/sub-1.jpg',
      },
    ]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/spaces/space-parent-1',
      {},
      {
        DB: {},
      }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'space-parent-1',
          subspaces: [
            expect.objectContaining({
              id: 'sub-1',
              name: '子空间 1',
            }),
          ],
        }),
      })
    );
  });

  it('excludes child spaces from the sales spaces top-level list', async () => {
    mocks.findAllForSalesperson.mockResolvedValue([
      {
        id: 'space-parent-1',
        name: '顶级空间',
        parent_id: null,
        template: 'gallery',
        template_data: '{}',
      },
      {
        id: 'space-child-1',
        name: '子空间',
        parent_id: 'space-parent-1',
        template: 'gallery',
        template_data: '{}',
      },
    ]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/spaces',
      {},
      {
        DB: {},
      }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        data: [
          expect.objectContaining({
            id: 'space-parent-1',
            name: '顶级空间',
          }),
        ],
      })
    );
  });

  it('excludes expired spaces from the sales spaces top-level list', async () => {
    mocks.findAllForSalesperson.mockResolvedValue([
      {
        id: 'space-active-1',
        name: '有效空间',
        parent_id: null,
        template: 'gallery',
        template_data: '{}',
        expires_at: null,
      },
      {
        id: 'space-expired-1',
        name: '过期空间',
        parent_id: null,
        template: 'gallery',
        template_data: '{}',
        expires_at: Date.now() - 1000,
      },
    ]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/spaces',
      {},
      {
        DB: {},
      }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data).toEqual([
      expect.objectContaining({
        id: 'space-active-1',
        name: '有效空间',
      }),
    ]);
  });

  it('returns 404 when salesperson requests an expired space detail', async () => {
    mocks.findByIdForSalesperson.mockResolvedValue({
      id: 'space-expired-1',
      name: '过期空间',
      template: 'collection',
      template_data: '{}',
      files: [],
      expires_at: Date.now() - 1000,
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/spaces/space-expired-1',
      {},
      {
        DB: {},
      }
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('excludes expired subspaces from sales collection detail', async () => {
    mocks.findByIdForSalesperson.mockResolvedValue({
      id: 'space-parent-1',
      name: '合集空间',
      template: 'collection',
      template_data: '{}',
      files: [],
      expires_at: null,
    });
    mocks.findSubspacesForSalesperson.mockResolvedValue([
      {
        id: 'sub-active-1',
        name: '有效子空间',
        template: 'gallery',
        share_token: 'sub-share-1',
        file_count: 3,
        cover_storage_key: 'covers/sub-1.jpg',
        expires_at: null,
      },
      {
        id: 'sub-expired-1',
        name: '过期子空间',
        template: 'gallery',
        share_token: 'sub-share-expired',
        file_count: 1,
        cover_storage_key: 'covers/sub-expired.jpg',
        expires_at: Date.now() - 1000,
      },
    ]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/spaces/space-parent-1',
      {},
      {
        DB: {},
      }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.subspaces).toEqual([
      expect.objectContaining({
        id: 'sub-active-1',
        name: '有效子空间',
      }),
    ]);
  });
});
