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

describe('variant pricing strategy', () => {
  it('getSuggestions should include pricing strategy fields per variant', async () => {
    const db = createDbForSuggestions([{
      variant_id: 'var-1',
      product_id: 'prod-1',
      product_code: 'P001',
      variant_code: 'V001',
      product_name: 'Tee',
      sku: 'TEE-YEL-S',
      brand: 'KK',
      cost_price: 50,
      suggested_purchase_price: 48,
      stock_quantity: 2,
      total_demand: 5,
      shortage: 3,
      order_count: 1,
      order_ids: 'o-1',
      images: '[]',
      variant_options: '{"color":"黄","size":"S"}',
    }]);
    const service = new PurchaseOrderService(db);
    service.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({
      'var-1': 46,
    }));

    const suggestions = await service.getSuggestions();

    expect(service.repo.getLastPurchasePricesByVariant).toHaveBeenCalledWith(['var-1']);
    expect(suggestions[0].variant_cost_price).toBe(50);
    expect(suggestions[0].suggested_purchase_price).toBe(48);
    expect(suggestions[0].last_purchase_price).toBe(46);
    expect(suggestions[0].price_delta).toBe(2);
  });

  it('getSuggestions should fallback when no historical purchase price exists', async () => {
    const db = createDbForSuggestions([{
      variant_id: 'var-2',
      product_id: 'prod-1',
      product_code: 'P001',
      variant_code: 'V002',
      product_name: 'Tee',
      sku: 'TEE-BLU-M',
      brand: 'KK',
      cost_price: 22,
      suggested_purchase_price: 0,
      stock_quantity: 0,
      total_demand: 4,
      shortage: 4,
      order_count: 1,
      order_ids: 'o-2',
      images: '[]',
      variant_options: '{"color":"蓝","size":"M"}',
    }]);
    const service = new PurchaseOrderService(db);
    service.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({}));

    const suggestions = await service.getSuggestions();

    expect(suggestions[0].variant_cost_price).toBe(22);
    expect(suggestions[0].suggested_purchase_price).toBe(22);
    expect(suggestions[0].last_purchase_price).toBe(null);
    expect(suggestions[0].price_delta).toBe(null);
  });
});
