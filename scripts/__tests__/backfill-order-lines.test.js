import { describe, expect, it } from 'vitest';
import {
  buildInsertOrderLineSql,
  buildSelectLegacyOrdersSql,
  mapLegacyOrderToOrderLine,
} from '../migrations/backfill-order-lines.mjs';

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

  it('maps delivered and void legacy orders to terminal line quantities and statuses', () => {
    const delivered = mapLegacyOrderToOrderLine({
      id: 'ord_delivered',
      product_id: 'prod_1',
      variant_id: 'variant_1',
      quantity: 3,
      status: 'delivered',
      procurement_status: 'arrived',
      current_data: JSON.stringify({ name: 'Bag B' }),
      created_at: 1700000000000,
      updated_at: 1700000100000,
    });

    expect(delivered.received_qty).toBe(3);
    expect(delivered.shipped_qty).toBe(3);
    expect(delivered.display_status).toBe('completed');

    const voided = mapLegacyOrderToOrderLine({
      id: 'ord_void',
      product_id: 'prod_2',
      variant_id: 'variant_2',
      quantity: 2,
      status: 'void',
      procurement_status: 'none',
      current_data: JSON.stringify({ name: 'Bag C' }),
      created_at: 1700000000000,
      updated_at: 1700000100000,
    });

    expect(voided.cancelled_qty).toBe(2);
    expect(voided.display_status).toBe('cancelled');
  });

  it('maps arrived procurement to ready line state for legacy orders', () => {
    const row = mapLegacyOrderToOrderLine({
      id: 'ord_ready',
      product_id: 'prod_3',
      variant_id: 'variant_3',
      quantity: 4,
      status: 'arrived',
      procurement_status: 'arrived',
      current_data: JSON.stringify({ name: 'Bag D' }),
      created_at: 1700000000000,
      updated_at: 1700000100000,
    });

    expect(row.procured_qty).toBe(4);
    expect(row.received_qty).toBe(4);
    expect(row.display_status).toBe('ready');
  });

  it('includes projected qty and display fields in generated insert SQL', () => {
    const sql = buildInsertOrderLineSql(
      {
        id: 'ord_sql',
        product_id: 'prod_sql',
        variant_id: 'variant_sql',
        quantity: 2,
        status: 'delivered',
        procurement_status: 'arrived',
        current_data: JSON.stringify({ name: 'Bag SQL' }),
        created_at: 1700000000000,
        updated_at: 1700000100000,
      },
      1700000200000
    );

    expect(sql).toContain('procured_qty');
    expect(sql).toContain('received_qty');
    expect(sql).toContain('shipped_qty');
    expect(sql).toContain('display_status');
    expect(sql).toContain("'completed'");
  });

  it('falls back to NULL procurement_status when legacy orders table lacks the column', () => {
    const sql = buildSelectLegacyOrdersSql({
      hasVariantId: true,
      hasProcurementStatus: false,
      limit: 10,
    });

    expect(sql).toContain('variant_id');
    expect(sql).toContain('NULL AS procurement_status');
    expect(sql).toContain('LIMIT 10');
  });

  it('does not fabricate received quantity for partially arrived legacy orders', () => {
    const row = mapLegacyOrderToOrderLine({
      id: 'ord_partial',
      product_id: 'prod_partial',
      variant_id: 'variant_partial',
      quantity: 5,
      status: 'confirmed',
      procurement_status: 'partially_arrived',
      current_data: JSON.stringify({ name: 'Bag Partial' }),
      created_at: 1700000000000,
      updated_at: 1700000100000,
    });

    expect(row.procured_qty).toBe(5);
    expect(row.received_qty).toBe(0);
    expect(row.display_status).toBe('fully_procured');
  });
});
