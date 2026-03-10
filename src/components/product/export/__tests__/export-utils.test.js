import { describe, it, expect } from 'vitest';
import {
  buildCsvContent,
  buildExcelWorkbook,
  EXPORT_COLUMNS,
  flattenProductsToVariantRows,
} from '../export-utils.js';

describe('product export utils', () => {
  it('flattens products into variant rows', () => {
    const rows = flattenProductsToVariantRows([
      {
        id: 'p1',
        name: 'Tee',
        spu: 'SPU-1',
        product_code: 'P001',
        created_at: 1700000000000,
        updated_at: 1700000000000,
        variants: [
          {
            id: 'v1',
            sku: 'SKU-1',
            variant_code: 'V001',
            options_values: { Color: 'Red', Size: 'L' },
            price: 100,
            stock_quantity: 8,
            on_hand: 8,
            reserved: 3,
            available_quantity: 2,
            alert_threshold: 5,
          },
        ],
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      product_id: 'p1',
      variant_id: 'v1',
      color: 'Red',
      size: 'L',
      stock_quantity: 2,
      stock_flag: 'LOW_STOCK',
    });
  });

  it('builds CSV content with headers and values', () => {
    const csv = buildCsvContent([
      { product_id: 'p1', product_name: 'Test' },
    ], EXPORT_COLUMNS.slice(0, 2));
    expect(csv).toContain('Product ID,Product Name');
    expect(csv).toContain('p1,Test');
  });

  it('builds excel workbook with grouped headers', () => {
    const wb = buildExcelWorkbook([
      { product_id: 'p1', product_name: 'Test', stock_flag: 'LOW_STOCK' },
    ], EXPORT_COLUMNS.slice(0, 2), {
      generatedAt: '2026-02-27T12:00:00.000Z',
      scopeLabel: 'All products',
      filtersLabel: '-',
    });
    expect(wb.SheetNames).toContain('Product Variants');
    const ws = wb.Sheets['Product Variants'];
    expect(String(ws.A1.v)).toContain('Product Variant Export Report');
    expect(String(ws.A2.v)).toContain('Generated At');
    expect(ws.A3.v).toBe('Product');
    expect(ws.A4.v).toBe('Product ID');
    expect(ws.A1.s).toBeTruthy();
    expect(ws.A4.s).toBeTruthy();
  });
});
