import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authFetch: mocks.authFetch,
  }),
}));

vi.mock('@/utils/constants', () => ({
  API: {
    SALES_PRODUCTS: (token) => `/api/sales/${token}/products`,
    SALES_PRODUCT_DETAIL: (token, productId) => `/api/sales/${token}/products/${productId}`,
  },
}));

import { useSalesProducts } from '../useSalesProducts';

describe('useSalesProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps state isolated between independent consumers', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          success: true,
          data: [{ id: 'prod-a' }],
          pagination: { total: 1, page: 1, limit: 12 },
        }),
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          success: true,
          data: [{ id: 'prod-b' }],
          pagination: { total: 1, page: 1, limit: 12 },
        }),
      });

    const first = useSalesProducts();
    const second = useSalesProducts();

    expect(first.products).not.toBe(second.products);
    expect(first.loading).not.toBe(second.loading);
    expect(first.error).not.toBe(second.error);
    expect(first.meta).not.toBe(second.meta);

    await first.loadSalesProducts('token-a', { search: 'desk' });

    expect(first.products.value).toEqual([{ id: 'prod-a' }]);
    expect(second.products.value).toEqual([]);

    await second.loadSalesProducts('token-b', { search: 'chair' });

    expect(first.products.value).toEqual([{ id: 'prod-a' }]);
    expect(second.products.value).toEqual([{ id: 'prod-b' }]);
  });

  it('keeps only the latest search result when requests resolve out of order', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.authFetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const salesProducts = useSalesProducts();
    const firstPending = salesProducts.loadSalesProducts('token-a', { search: 'desk' });
    const secondPending = salesProducts.loadSalesProducts('token-a', { search: 'chair' });

    resolveSecond({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: 'prod-chair' }],
        meta: { total: 1, page: 1, limit: 12 },
      }),
    });
    await secondPending;

    expect(salesProducts.products.value).toEqual([{ id: 'prod-chair' }]);

    resolveFirst({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: 'prod-desk' }],
        meta: { total: 1, page: 1, limit: 12 },
      }),
    });
    await firstPending;

    expect(salesProducts.products.value).toEqual([{ id: 'prod-chair' }]);
  });
});
