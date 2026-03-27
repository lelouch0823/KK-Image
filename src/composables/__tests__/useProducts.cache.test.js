import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const resource = {
    items: { value: [] },
    loading: { value: false },
    error: { value: null },
    errorCode: { value: null },
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    loadItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    rawRequest: vi.fn(),
    clearCache: vi.fn(),
  };
  return { resource };
});

vi.mock('../useResource', () => ({
  useResource: vi.fn(() => mocks.resource),
}));

import { useProducts } from '../useProducts';

describe('useProducts cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears resource cache after createProductWithMeta succeeds', async () => {
    mocks.resource.rawRequest.mockResolvedValueOnce({ success: true, data: { id: 'p-1' } });

    const { createProductWithMeta } = useProducts();
    const result = await createProductWithMeta({ name: 'Product A', variants: [] });

    expect(result.success).toBe(true);
    expect(mocks.resource.clearCache).toHaveBeenCalledTimes(1);
  });

  it('clears resource cache after updateProductWithMeta succeeds', async () => {
    mocks.resource.rawRequest.mockResolvedValueOnce({ success: true });

    const { updateProductWithMeta } = useProducts();
    const result = await updateProductWithMeta('p-1', { name: 'Product B', variants: [] });

    expect(result.success).toBe(true);
    expect(mocks.resource.clearCache).toHaveBeenCalledTimes(1);
  });

  it('does not clear resource cache when write fails', async () => {
    mocks.resource.rawRequest.mockResolvedValueOnce({ success: false, error: 'update failed' });

    const { updateProductWithMeta } = useProducts();
    const result = await updateProductWithMeta('p-1', { name: 'Product C', variants: [] });

    expect(result.success).toBe(false);
    expect(mocks.resource.clearCache).not.toHaveBeenCalled();
  });

  it('forwards full export filters when listing products for export', async () => {
    mocks.resource.rawRequest.mockResolvedValueOnce({ success: true, data: [] });

    const { listProductsForExport } = useProducts();
    await listProductsForExport({
      search: 'desk',
      status: 'active',
      brand: 'ACME',
      category: 'Furniture',
      hasStock: 'in_stock',
      sortBy: 'stock',
      sortOrder: 'asc',
      page: 2,
      limit: 50,
    });

    expect(mocks.resource.rawRequest).toHaveBeenCalledWith(
      '?page=2&limit=50&search=desk&status=active&brand=ACME&category=Furniture&hasStock=in_stock&sortBy=stock&sortOrder=asc'
    );
  });
});
