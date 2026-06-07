import { describe, it, expect } from 'vitest';
import {
  buildCsvContent,
  buildExcelWorkbook,
  EXPORT_COLUMNS,
  flattenProductsToVariantRows,
  normalizeProductExportFilters,
} from '../export-utils';

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

  it('maps color/size/material columns through dimension_map and localized labels', () => {
    const rows = flattenProductsToVariantRows([
      {
        id: 'p2',
        name: 'Chair',
        dimension_map: { dim_color: '颜色', dim_size: '尺寸', dim_material: '材质' },
        variants: [
          {
            id: 'v2',
            sku: 'SKU-2',
            options_values: {
              dim_color: '黑色',
              dim_size: 'L',
              dim_material: '羊毛',
            },
          },
        ],
      },
      {
        id: 'p3',
        name: 'Lamp',
        variants: [
          {
            id: 'v3',
            sku: 'SKU-3',
            options_values: {
              颜色: '白色',
              尺寸: 'S',
              材质: '木质',
            },
          },
        ],
      },
    ]);

    expect(rows[0]).toMatchObject({
      color: '黑色',
      size: 'L',
      material: '羊毛',
    });
    expect(rows[1]).toMatchObject({
      color: '白色',
      size: 'S',
      material: '木质',
    });
  });

  it('builds CSV content with headers and values', () => {
    const csv = buildCsvContent(
      [{ product_id: 'p1', product_name: 'Test' }],
      EXPORT_COLUMNS.slice(0, 2)
    );
    expect(csv).toContain('Product ID,Product Name');
    expect(csv).toContain('p1,Test');
  });

  it('neutralizes spreadsheet formula prefixes in csv cells', () => {
    const csv = buildCsvContent(
      [{ product_id: '=cmd', product_name: '+SUM(1,2)' }],
      EXPORT_COLUMNS.slice(0, 2)
    );

    expect(csv).toContain("'=cmd");
    expect(csv).toContain("'+SUM(1,2)");
  });

  it('normalizes filters by scope for export callers', () => {
    expect(
      normalizeProductExportFilters('filtered', {
        search: 'desk',
        status: 'active',
        brand: 'ACME',
        category: 'Furniture',
        hasStock: 'in_stock',
        sortBy: 'stock',
        sortOrder: 'asc',
      })
    ).toEqual({
      search: 'desk',
      status: 'active',
      brand: 'ACME',
      category: 'Furniture',
      hasStock: 'in_stock',
      sortBy: 'stock',
      sortOrder: 'asc',
    });

    expect(
      normalizeProductExportFilters('all', {
        search: 'desk',
        status: 'active',
      })
    ).toEqual({
      search: '',
      status: '',
      brand: '',
      category: '',
      hasStock: '',
      sortBy: '',
      sortOrder: '',
    });
  });

  it('builds excel workbook with grouped headers', async () => {
    const wb = await buildExcelWorkbook(
      [{ product_id: 'p1', product_name: 'Test', stock_flag: 'LOW_STOCK' }],
      EXPORT_COLUMNS.slice(0, 2),
      {
        generatedAt: '2026-02-27T12:00:00.000Z',
        scopeLabel: 'All products',
        filtersLabel: '-',
      }
    );
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
