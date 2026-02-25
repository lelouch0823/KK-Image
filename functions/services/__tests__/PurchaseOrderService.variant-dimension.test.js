import { describe, it, expect, vi } from 'vitest';
import { PurchaseOrderService } from '../PurchaseOrderService.js';

function createDbForSuggestions(results) {
  const stmt = {
    bind: vi.fn(() => stmt),
    all: vi.fn(async () => ({ results })),
  };
  return {
    prepare: vi.fn(() => stmt),
  };
}

describe('PurchaseOrderService variant dimension', () => {
  it('getSuggestions should aggregate by variant and expose variant_id', async () => {
    const db = createDbForSuggestions([{
      variant_id: 'var-1',
      product_id: 'prod-1',
      product_code: 'P0001',
      variant_code: 'V0001',
      product_name: 'Tee',
      sku: 'TEE-YELLOW-S',
      brand: 'KK',
      cost_price: 12.5,
      stock_quantity: 3,
      total_demand: 8,
      shortage: 5,
      order_count: 2,
      order_ids: 'o-1,o-2',
      images: '[]',
    }]);
    const service = new PurchaseOrderService(db);

    const suggestions = await service.getSuggestions();
    const sql = db.prepare.mock.calls[0][0];

    expect(sql).toContain('o.variant_id');
    expect(sql).toContain('GROUP BY o.variant_id');
    expect(suggestions[0].variant_id).toBe('var-1');
    expect(suggestions[0].product_code).toBe('P0001');
    expect(suggestions[0].variant_code).toBe('V0001');
  });

  it('createFromOrders should carry variant_id into PO items', async () => {
    const mockAll = vi.fn(async () => ({
      results: [{
        id: 'o-1',
        order_no: 'SO-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 2,
        name: 'Tee',
        sku: 'TEE-YELLOW-S',
        cost_price: 11,
      }],
    }));
    const stmt = {
      bind: vi.fn(() => stmt),
      all: mockAll,
    };
    const db = { prepare: vi.fn(() => stmt) };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
    };

    await service.createFromOrders(['o-1']);

    expect(service.repo.addItems).toHaveBeenCalledWith('po-1', [
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
      }),
    ]);
  });

  it('_updateInventory should reject items without variant_id', async () => {
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn() })),
      batch: vi.fn(),
    };
    const service = new PurchaseOrderService(db);

    await expect(service._updateInventory([
      { product_id: 'prod-1', quantity: 3 },
    ], 'increment')).rejects.toThrow(/variant_id/i);
  });
});
