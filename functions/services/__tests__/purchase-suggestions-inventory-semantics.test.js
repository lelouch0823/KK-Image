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

  it('chunks variant suggestion reads when demand spans more than the D1 variable limit', async () => {
    const demandRows = Array.from({ length: 1005 }, (_, index) => ({
      variant_id: `variant-${index + 1}`,
      total_demand: 5,
      order_count: 1,
      order_ids: [`order-${index + 1}`],
    }));
    const variantQueryBinds = [];
    const db = {
      prepare: vi.fn((sql) => ({
        bind: (...args) => {
          if (sql.includes('FROM product_variants pv')) {
            variantQueryBinds.push(args);
          }
          return {
            all: vi.fn(async () => ({
              results: sql.includes('FROM product_variants pv')
                ? args.map((variantId) => ({
                    variant_id: variantId,
                    product_id: `product-${variantId}`,
                    product_code: `P-${variantId}`,
                    variant_code: `V-${variantId}`,
                    product_name: `Product ${variantId}`,
                    sku: `SKU-${variantId}`,
                    brand: 'KK',
                    cost_price: 10,
                    suggested_purchase_price: 0,
                    on_hand: 0,
                    reserved: 0,
                    available: 0,
                    images: '[]',
                    variant_options: '{"Color":"Red"}',
                  }))
                : [],
            })),
          };
        },
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({}));
    service.demandService = {
      getDemandSummaryByVariant: vi.fn(async () => demandRows),
    };

    const suggestions = await service.getSuggestions();

    expect(suggestions).toHaveLength(1005);
    expect(variantQueryBinds.length).toBeGreaterThan(1);
    expect(Math.max(...variantQueryBinds.map((args) => args.length))).toBeLessThanOrEqual(100);
  });
});
