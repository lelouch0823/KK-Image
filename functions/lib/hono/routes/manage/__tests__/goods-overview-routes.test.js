import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  requiredPermissions: [],
  getList: vi.fn(),
  getAvailableFilters: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: (permission) => async (_c, next) => {
    mocks.requiredPermissions.push(permission);
    await next();
  },
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => {
    await next();
  },
}));

vi.mock('../../../../../repositories/GoodsOverviewRepository.js', () => ({
  GoodsOverviewRepository: vi.fn(() => ({
    getList: mocks.getList,
    getAvailableFilters: mocks.getAvailableFilters,
    getSummary: mocks.getSummary,
  })),
}));

import goodsOverviewApp from '../goods-overview.js';

function createApp() {
  const app = new Hono();
  app.route('/api/manage/goods-overview', goodsOverviewApp);
  return app;
}

describe('manage goods overview routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requiredPermissions.length = 0;
    mocks.getList.mockResolvedValue([
      {
        id: 'var-1',
        name: 'Tee',
        variantLabel: 'Black / L',
        sku: 'TEE-BLACK-L',
        brand: 'KK',
        category: 'Top',
        stockQuantity: 3,
        confirmedQty: 2,
        productionQty: 1,
        shippingQty: 0,
        arrivedQty: 0,
        totalDemand: 3,
        orderCount: 1,
        shortage: 0,
        avgUnitCost: 10,
        avgFreight: 1,
        avgTariff: 0.5,
        landedCost: 11.5,
      },
    ]);
    mocks.getAvailableFilters.mockResolvedValue({ categories: ['Top'], brands: ['KK'] });
    mocks.getSummary.mockResolvedValue({ totalProducts: 1, shortageCount: 0, totalDemand: 3 });
  });

  it('lists goods overview with current filters', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/goods-overview?category=Top&brand=KK&shortageOnly=1&sort=demand',
      { method: 'GET' },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    expect(mocks.requiredPermissions).toContain('products:manage');
    expect(mocks.getList).toHaveBeenCalledWith({
      category: 'Top',
      brand: 'KK',
      shortageOnly: true,
      sort: 'demand',
    });
    expect(mocks.getAvailableFilters).toHaveBeenCalledTimes(1);
  });

  it('exports csv with the current filters instead of forcing full demand sort', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/goods-overview/export?category=Top&brand=KK&shortageOnly=1&sort=name',
      { method: 'GET' },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(mocks.getList).toHaveBeenCalledWith({
      category: 'Top',
      brand: 'KK',
      shortageOnly: true,
      sort: 'name',
    });
    const csv = await res.text();
    expect(csv).toContain('Tee');
    expect(csv).toContain('Black / L');
  });

  it('neutralizes spreadsheet formula prefixes in exported csv cells', async () => {
    mocks.getList.mockResolvedValueOnce([
      {
        id: 'var-danger',
        name: '=cmd',
        variantLabel: '@danger',
        sku: '+SUM(1,2)',
        brand: '-KK',
        category: 'Top',
        stockQuantity: 1,
        confirmedQty: 0,
        productionQty: 0,
        shippingQty: 0,
        arrivedQty: 0,
        totalDemand: 1,
        orderCount: 1,
        shortage: 0,
        avgUnitCost: 1,
        avgFreight: 0,
        avgTariff: 0,
        landedCost: 1,
      },
    ]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/goods-overview/export',
      { method: 'GET' },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain(`"'=cmd"`);
    expect(csv).toContain(`"'@danger"`);
    expect(csv).toContain(`"'+SUM(1,2)"`);
    expect(csv).toContain(`"'-KK"`);
  });
});
