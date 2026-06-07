import { describe, expect, it, vi } from 'vitest';
import { PurchaseOrderService } from '../PurchaseOrderService.js';

describe('purchase suggestions inventory semantics', () => {
  it('reads shared variant demand projection and stock semantics to compute shortage', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => {
            if (sql.includes('FROM variant_demand_projection vdp')) {
              return {
                results: [
                  {
                    variant_id: 'variant-1',
                    total_demand: 8,
                    order_count: 2,
                    order_ids: 'o-1,o-2',
                  },
                ],
              };
            }
            return {
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
            };
          }),
        })),
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({}));
    service.demandService = { getDemandSummaryByVariant: vi.fn(async () => []) };

    const suggestions = await service.getSuggestions();
    const sqlCalls = db.prepare.mock.calls.map((call) => call[0]);

    expect(service.demandService.getDemandSummaryByVariant).not.toHaveBeenCalled();
    expect(sqlCalls.some((sql) => sql.includes('FROM variant_demand_projection vdp'))).toBe(true);
    expect(
      sqlCalls.some(
        (sql) => sql.includes('FROM product_variants pv') && sql.includes('inventory_balances')
      )
    ).toBe(true);
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

  it('chunks variant suggestion reads when projection demand spans more than the D1 variable limit', async () => {
    const projectionRows = Array.from({ length: 1005 }, (_, index) => ({
      variant_id: `variant-${index + 1}`,
      total_demand: 5,
      order_count: 1,
      order_ids: `order-${index + 1}`,
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
              results: sql.includes('FROM variant_demand_projection vdp')
                ? projectionRows
                : args.map((variantId) => ({
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
                  })),
            })),
          };
        },
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({}));

    const suggestions = await service.getSuggestions();

    expect(suggestions).toHaveLength(1005);
    expect(variantQueryBinds.length).toBeGreaterThan(1);
    expect(Math.max(...variantQueryBinds.map((args) => args.length))).toBeLessThanOrEqual(100);
  });
  it('keeps shortage suggestions visible when the demanded variant has since been archived', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => {
            if (sql.includes('FROM variant_demand_projection vdp')) {
              return {
                results: [
                  {
                    variant_id: 'variant-archived',
                    total_demand: 6,
                    order_count: 1,
                    order_ids: 'o-archived',
                  },
                ],
              };
            }
            return {
              results: [
                {
                  variant_id: 'variant-archived',
                  product_id: 'product-1',
                  product_code: 'P001',
                  variant_code: 'V001',
                  product_name: 'Archived Tee',
                  sku: 'TEE-ARCHIVED',
                  brand: 'KK',
                  cost_price: 20,
                  suggested_purchase_price: 18,
                  on_hand: 1,
                  reserved: 0,
                  available: 1,
                  images: '[]',
                  variant_options: '{"Color":"Red"}',
                  variant_status: 'archived',
                },
              ],
            };
          }),
        })),
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({}));

    const suggestions = await service.getSuggestions();
    const sqlCalls = db.prepare.mock.calls.map((call) => call[0]);

    expect(sqlCalls.some((sql) => sql.includes('FROM variant_demand_projection vdp'))).toBe(true);
    expect(
      sqlCalls.some(
        (sql) =>
          sql.includes('FROM product_variants pv') && !sql.includes("AND pv.status = 'active'")
      )
    ).toBe(true);
    expect(suggestions).toEqual([
      expect.objectContaining({
        variant_id: 'variant-archived',
        total_demand: 6,
        available_quantity: 1,
        shortage: 5,
      }),
    ]);
  });

  it('keeps shortage suggestions visible when live product rows are gone but order-line snapshots remain', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => {
            if (sql.includes('FROM variant_demand_projection vdp')) {
              return {
                results: [
                  {
                    variant_id: 'variant-deleted',
                    total_demand: 4,
                    order_count: 1,
                    order_ids: 'o-deleted',
                  },
                ],
              };
            }
            if (sql.includes('FROM product_variants pv')) {
              return { results: [] };
            }
            if (sql.includes('FROM order_lines ol')) {
              return {
                results: [
                  {
                    variant_id: 'variant-deleted',
                    product_id: 'product-deleted',
                    product_name: 'Snapshot Tee',
                    sku: 'SNAPSHOT-SKU',
                    brand: 'Snapshot Brand',
                    cost_price: 0,
                    suggested_purchase_price: 0,
                    on_hand: 0,
                    reserved: 0,
                    available: 0,
                    images: '["snapshot-image"]',
                    variant_options: '{"color":"Black","size":"L","material":"Canvas"}',
                  },
                ],
              };
            }
            return { results: [] };
          }),
        })),
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({}));

    const suggestions = await service.getSuggestions();
    const sqlCalls = db.prepare.mock.calls.map((call) => call[0]);

    expect(sqlCalls.some((sql) => sql.includes('FROM variant_demand_projection vdp'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('FROM product_variants pv'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('FROM order_lines ol'))).toBe(true);
    expect(suggestions).toEqual([
      expect.objectContaining({
        variant_id: 'variant-deleted',
        product_id: 'product-deleted',
        product_name: 'Snapshot Tee',
        sku: 'SNAPSHOT-SKU',
        brand: 'Snapshot Brand',
        total_demand: 4,
        available_quantity: 0,
        shortage: 4,
        variant_display_name: 'Black / Canvas / L',
      }),
    ]);
  });
});
