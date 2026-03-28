import { describe, expect, it } from 'vitest';
import { mapLegacyOrderToOrderLine } from '../migrations/backfill-order-lines.mjs';

describe('backfill-order-lines mapping', () => {
  it('prefers top-level orders.variant_id over current_data.variant_id', () => {
    const row = mapLegacyOrderToOrderLine(
      {
        id: 'ord_1',
        product_id: 'prod_1',
        variant_id: 'variant_from_order',
        quantity: 2,
        current_data: JSON.stringify({
          variant_id: 'variant_from_current_data',
          name: 'Bag A',
          sku: 'SKU-A',
        }),
        main_image_id: 'img_1',
        created_at: 1700000000000,
        updated_at: 1700000100000,
      },
      1700000200000
    );

    expect(row.order_id).toBe('ord_1');
    expect(row.variant_id).toBe('variant_from_order');
    expect(row.snapshot_name).toBe('Bag A');
    expect(row.snapshot_sku).toBe('SKU-A');
    expect(row.ordered_qty).toBe(2);
  });
});
