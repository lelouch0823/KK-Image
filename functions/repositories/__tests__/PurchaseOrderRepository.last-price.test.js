import { describe, expect, it, vi } from 'vitest';
import { PurchaseOrderRepository } from '../PurchaseOrderRepository.js';

describe('PurchaseOrderRepository last purchase prices', () => {
  it('chunks variant lookups when the requested ids exceed the D1 variable limit', async () => {
    const queryBinds = [];
    const db = {
      prepare: vi.fn((sql) => ({
        bind: (...args) => {
          queryBinds.push(args);
          return {
            all: vi.fn(async () => ({
              results: args.map((variantId) => ({
                variant_id: variantId,
                last_purchase_price: 12,
              })),
            })),
          };
        },
      })),
    };
    const repo = new PurchaseOrderRepository(db);
    const variantIds = Array.from({ length: 1005 }, (_, index) => `variant-${index + 1}`);

    const priceMap = await repo.getLastPurchasePricesByVariant(variantIds);

    expect(queryBinds.length).toBeGreaterThan(1);
    expect(Math.max(...queryBinds.map((args) => args.length))).toBeLessThanOrEqual(100);
    expect(Object.keys(priceMap)).toHaveLength(1005);
    expect(priceMap['variant-1']).toBe(12);
    expect(priceMap['variant-1005']).toBe(12);
  });
});
