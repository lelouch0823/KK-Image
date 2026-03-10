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
            on_hand: 7,
            reserved: 2,
            available: 3,
            images: '[]',
            variant_options: '{"Color":"Red"}',
          },
        ],
      })),
    };
    const db = {
      prepare: vi.fn(() => stmt),
    };
    const service = new PurchaseOrderService(db);
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
    const variantReadSql = db.prepare.mock.calls[0][0];

    expect(service.demandService.getDemandSummaryByVariant).toHaveBeenCalledTimes(1);
    expect(variantReadSql).toContain('inventory_balances');
    expect(variantReadSql).toContain('available');
    expect(suggestions).toEqual([
      expect.objectContaining({
        variant_id: 'variant-1',
        stock_quantity: 7,
        available_quantity: 3,
        total_demand: 8,
        shortage: 5,
        order_ids: ['o-1', 'o-2'],
      }),
    ]);
  });
});
