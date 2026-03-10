import { describe, expect, it, vi } from 'vitest';
import { PurchaseOrderService } from '../PurchaseOrderService.js';

describe('purchase suggestions inventory semantics', () => {
  it('uses shared demand summary and stock semantics to compute shortage', async () => {
    const stmt = {
      bind: vi.fn(() => stmt),
      all: vi.fn(async () => ({
        results: [
          {
            variant_id: 'variant-1',
            product_id: 'product-1',
            product_code: 'P001',
            variant_code: 'V001',
            product_name: 'Tee',
            sku: 'TEE-RED-M',
            brand: 'KK',
            cost_price: 20,
            suggested_purchase_price: 18,
            stock_quantity: 3,
            images: '[]',
            variant_options: '{"Color":"Red"}',
          },
        ],
      })),
    };
    const service = new PurchaseOrderService({
      prepare: vi.fn(() => stmt),
    });
    service.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({}));
    service.demandService = {
      getDemandSummaryByVariant: vi.fn(async () => [
        {
          variant_id: 'variant-1',
          total_demand: 8,
          order_count: 2,
          order_ids: ['o-1', 'o-2'],
        },
      ]),
    };

    const suggestions = await service.getSuggestions();

    expect(service.demandService.getDemandSummaryByVariant).toHaveBeenCalledTimes(1);
    expect(suggestions).toEqual([
      expect.objectContaining({
        variant_id: 'variant-1',
        stock_quantity: 3,
        total_demand: 8,
        shortage: 5,
        order_ids: ['o-1', 'o-2'],
      }),
    ]);
  });
});
