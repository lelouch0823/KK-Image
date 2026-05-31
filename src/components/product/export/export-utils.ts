export const PRODUCT_EXPORT_FILTER_KEYS: readonly string[] = Object.freeze([
  'search',
  'status',
  'brand',
  'category',
  'hasStock',
  'sortBy',
  'sortOrder',
]);

export const EXPORT_COLUMNS: readonly any[] = [
  { key: 'product_id', label: 'Product ID', group: 'Product', width: 22 },
  { key: 'product_name', label: 'Product Name', group: 'Product', width: 20 },
  { key: 'spu', label: 'SPU', group: 'Product', width: 14 },
  { key: 'product_code', label: 'Product Code', group: 'Product', width: 16 },
  { key: 'category', label: 'Category', group: 'Product', width: 14 },
  { key: 'brand', label: 'Brand', group: 'Product', width: 12 },
  { key: 'series', label: 'Series', group: 'Product', width: 12 },
  { key: 'currency', label: 'Currency', group: 'Product', width: 10 },
  { key: 'product_status', label: 'Product Status', group: 'Product', width: 14 },
  { key: 'description', label: 'Description', group: 'Product', width: 24 },
  { key: 'product_created_at', label: 'Product Created At', group: 'Product', width: 20 },
  { key: 'product_updated_at', label: 'Product Updated At', group: 'Product', width: 20 },
  { key: 'variant_id', label: 'Variant ID', group: 'Variant', width: 22 },
  { key: 'sku', label: 'SKU', group: 'Variant', width: 14 },
  { key: 'variant_code', label: 'Variant Code', group: 'Variant', width: 16 },
  { key: 'barcode', label: 'Barcode', group: 'Variant', width: 16 },
  { key: 'supplier_sku', label: 'Supplier SKU', group: 'Variant', width: 16 },
  { key: 'variant_status', label: 'Variant Status', group: 'Variant', width: 14 },
  { key: 'color', label: 'Color', group: 'Variant', width: 12 },
  { key: 'size', label: 'Size', group: 'Variant', width: 12 },
  { key: 'material', label: 'Material', group: 'Variant', width: 12 },
  { key: 'options_json', label: 'Options JSON', group: 'Variant', width: 22 },
  { key: 'image_id', label: 'Image ID', group: 'Variant', width: 22 },
  { key: 'price', label: 'Price', group: 'Pricing & Stock', width: 12, type: 'number' },
  { key: 'cost_price', label: 'Cost Price', group: 'Pricing & Stock', width: 12, type: 'number' },
  { key: 'stock_quantity', label: 'Stock Qty', group: 'Pricing & Stock', width: 10, type: 'number' },
  { key: 'alert_threshold', label: 'Alert Threshold', group: 'Pricing & Stock', width: 12, type: 'number' },
  { key: 'moq', label: 'MOQ', group: 'Pricing & Stock', width: 10, type: 'number' },
  { key: 'pack_size', label: 'Pack Size', group: 'Pricing & Stock', width: 10, type: 'number' },
  { key: 'order_step', label: 'Order Step', group: 'Pricing & Stock', width: 10, type: 'number' },
  { key: 'stock_flag', label: 'Stock Flag', group: 'Pricing & Stock', width: 14 },
  { key: 'variant_created_at', label: 'Variant Created At', group: 'Status & Time', width: 20 },
  { key: 'variant_updated_at', label: 'Variant Updated At', group: 'Status & Time', width: 20 },
];

const normalizeOptions = (value: unknown): Record<string, string> => {
  const options = value && typeof value === 'object' ? value as Record<string, any> : {};
  return Object.fromEntries(
    Object.entries(options).map(([k, v]) => [String(k || '').toLowerCase(), String(v ?? '')])
  );
};

const COLOR_LABELS = new Set(['color', '颜色', '顏色']);
const SIZE_LABELS = new Set(['size', '尺寸', '尺码', '尺碼']);
const MATERIAL_LABELS = new Set(['material', '材质', '材質']);

const normalizeLabel = (value: unknown): string => String(value || '').trim().toLowerCase();

const resolveMappedOptionColumns = (product: any, variant: any): { color: string; size: string; material: string } => {
  const rawOptions = variant?.options_values && typeof variant.options_values === 'object'
    ? variant.options_values
    : {};
  const dimensionMap = product?.dimension_map && typeof product.dimension_map === 'object'
    ? product.dimension_map
    : {};

  let color = '';
  let size = '';
  let material = '';

  for (const [rawKey, rawValue] of Object.entries(rawOptions)) {
    const value = String(rawValue ?? '').trim();
    if (!value) continue;

    const resolvedLabel = normalizeLabel(dimensionMap[rawKey] || rawKey);
    if (!color && COLOR_LABELS.has(resolvedLabel)) {
      color = value;
      continue;
    }
    if (!size && SIZE_LABELS.has(resolvedLabel)) {
      size = value;
      continue;
    }
    if (!material && MATERIAL_LABELS.has(resolvedLabel)) {
      material = value;
    }
  }

  return { color, size, material };
};

const formatDate = (timestamp: unknown): string => {
  if (!timestamp) return '';
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

const toNumericOrEmpty = (value: unknown): number | '' => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : '';
};

const resolveProjectedStock = ({ available_quantity, available, on_hand, stock_quantity }: Record<string, any>): number => {
  if (available_quantity !== undefined && available_quantity !== null && available_quantity !== '') {
    return Number(available_quantity) || 0;
  }
  if (available !== undefined && available !== null && available !== '') {
    return Number(available) || 0;
  }
  if (on_hand !== undefined && on_hand !== null && on_hand !== '') {
    return Number(on_hand) || 0;
  }
  return Number(stock_quantity || 0) || 0;
};

const resolveStockFlag = (variant: any): string => {
  const stock = resolveProjectedStock(variant || {});
  const alert = Number(variant?.alert_threshold || 0);
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (alert > 0 && stock <= alert) return 'LOW_STOCK';
  return 'NORMAL';
};
const normalizeVariantStatus = (variant: any): string => String(variant?.status || '').trim().toLowerCase();

const neutralizeSpreadsheetFormula = (value: unknown): string => {
  const normalized = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
};

const variantMatchesExportFilters = (variant: any, filters: Record<string, any> = {}): boolean => {
  const normalizedStatus = String(filters?.status || '').trim().toLowerCase();
  const normalizedHasStock = String(filters?.hasStock || '').trim().toLowerCase();

  if (!variant) {
    return !normalizedStatus && !normalizedHasStock;
  }

  if (normalizedStatus && normalizeVariantStatus(variant) !== normalizedStatus) {
    return false;
  }

  const projectedStock = resolveProjectedStock(variant || {});
  if (normalizedHasStock === 'in_stock' && projectedStock <= 0) {
    return false;
  }
  if (normalizedHasStock === 'out_of_stock' && projectedStock > 0) {
    return false;
  }

  return true;
};


export const normalizeProductExportFilters = (scope: string = 'all', filters: Record<string, any> = {}): Record<string, string> => {
  const normalized = Object.fromEntries(
    PRODUCT_EXPORT_FILTER_KEYS.map((key) => [key, String(filters?.[key] || '').trim()])
  );

  if (scope !== 'filtered') {
    return Object.fromEntries(PRODUCT_EXPORT_FILTER_KEYS.map((key) => [key, '']));
  }

  return normalized;
};

export const flattenProductsToVariantRows = (products: any[] = [], filters: Record<string, any> = {}): any[] => {
  const rows: any[] = [];
  for (const product of products) {
    const productVariants = Array.isArray(product?.variants) && product.variants.length > 0
      ? product.variants.filter((variant: any) => variantMatchesExportFilters(variant, filters))
      : [null].filter((variant: any) => variantMatchesExportFilters(variant, filters));
    if (Array.isArray(product?.variants) && product.variants.length > 0 && productVariants.length === 0) {
      continue;
    }
    for (const variant of productVariants) {
      const options = normalizeOptions(variant?.options_values || {});
      const mappedColumns = resolveMappedOptionColumns(product, variant);
      const row = {
        product_id: product?.id || '',
        product_name: product?.name || '',
        spu: product?.spu || '',
        product_code: product?.product_code || '',
        category: product?.category || '',
        brand: product?.brand || '',
        series: product?.series || '',
        currency: product?.currency || 'CNY',
        product_status: product?.status || '',
        description: product?.description || '',
        product_created_at: formatDate(product?.created_at),
        product_updated_at: formatDate(product?.updated_at),
        variant_id: variant?.id || '',
        sku: variant?.sku || '',
        variant_code: variant?.variant_code || '',
        barcode: variant?.barcode || '',
        supplier_sku: variant?.supplier_sku || '',
        variant_status: variant?.status || '',
        color: mappedColumns.color || options.color || '',
        size: mappedColumns.size || options.size || '',
        material: mappedColumns.material || options.material || '',
        options_json: JSON.stringify(variant?.options_values || {}),
        image_id: variant?.image_id || variant?.primaryImage || '',
        price: toNumericOrEmpty(variant?.price),
        cost_price: toNumericOrEmpty(variant?.cost_price),
        stock_quantity: toNumericOrEmpty(resolveProjectedStock(variant || {})),
        alert_threshold: toNumericOrEmpty(variant?.alert_threshold),
        moq: toNumericOrEmpty(variant?.moq),
        pack_size: toNumericOrEmpty(variant?.pack_size),
        order_step: toNumericOrEmpty(variant?.order_step),
        stock_flag: resolveStockFlag(variant || {}),
        variant_created_at: formatDate(variant?.created_at),
        variant_updated_at: formatDate(variant?.updated_at),
      };
      rows.push(row);
    }
  }
  return rows;
};

export const buildCsvContent = (rows: any[] = [], columns: readonly any[] = EXPORT_COLUMNS): string => {
  const escapeCell = (value: unknown): string => {
    const str = neutralizeSpreadsheetFormula(value);
    const escaped = str.replace(/"/g, '""');
    if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  const header = columns.map((col) => escapeCell(col.label)).join(',');
  const body = rows
    .map((row) => columns.map((col) => escapeCell(row[col.key])).join(','))
    .join('\n');
  return `﻿${header}\n${body}`;
};

const getGroupMerges = (columns: readonly any[], row: number = 0): any[] => {
  const merges: any[] = [];
  let start = 0;
  while (start < columns.length) {
    const group = columns[start].group;
    let end = start;
    while (end + 1 < columns.length && columns[end + 1].group === group) {
      end++;
    }
    if (end > start) {
      merges.push({ s: { r: row, c: start }, e: { r: row, c: end } });
    }
    start = end + 1;
  }
  return merges;
};

const colToExcelName = (index: number): string => {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

let _xlsx: any = null;
async function getXLSX(): Promise<any> {
  if (!_xlsx) _xlsx = await import('xlsx-js-style');
  return _xlsx;
}

export const buildExcelWorkbook = async (rows: any[] = [], columns: readonly any[] = EXPORT_COLUMNS, meta: Record<string, any> = {}): Promise<any> => {
  const XLSX = await getXLSX();
  const generatedAt = meta.generatedAt || new Date().toISOString();
  const scopeLabel = meta.scopeLabel || 'All products';
  const filtersLabel = meta.filtersLabel || '-';

  const reportTitle = [`Product Variant Export Report (${rows.length} rows)`];
  const reportMeta = [`Generated At: ${generatedAt} | Scope: ${scopeLabel} | Filters: ${filtersLabel}`];
  const groupHeader = columns.map((col) => col.group);
  const fieldHeader = columns.map((col) => col.label);
  const dataRows = rows.map((row) => columns.map((col) => row[col.key]));
  const sheetData = [reportTitle, reportMeta, groupHeader, fieldHeader, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
    ...getGroupMerges(columns, 2),
  ];
  ws['!cols'] = columns.map((col) => ({ wch: col.width || 14 }));
  ws['!autofilter'] = { ref: `A4:${colToExcelName(columns.length - 1)}4` };
  ws['!freeze'] = { xSplit: 0, ySplit: 4, topLeftCell: 'A5', activePane: 'bottomLeft', state: 'frozen' };

  const titleStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 },
    fill: { fgColor: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const metaStyle = {
    font: { color: { rgb: '334155' }, sz: 10 },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const groupHeaderStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E40AF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const fieldHeaderStyle = {
    font: { bold: true, color: { rgb: '1E3A8A' } },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const baseDataStyle = {
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } },
    },
  };

  const zebraStyle = {
    ...baseDataStyle,
    fill: { fgColor: { rgb: 'F8FAFC' } },
  };

  const lowStockStyle = {
    ...baseDataStyle,
    fill: { fgColor: { rgb: 'FEF3C7' } },
    font: { color: { rgb: '92400E' }, bold: true },
  };

  const outOfStockStyle = {
    ...baseDataStyle,
    fill: { fgColor: { rgb: 'FEE2E2' } },
    font: { color: { rgb: '991B1B' }, bold: true },
  };

  columns.forEach((_: any, colIndex: number) => {
    const groupCellAddress = `${colToExcelName(colIndex)}3`;
    if (ws[groupCellAddress]) ws[groupCellAddress].s = groupHeaderStyle;
    const fieldCellAddress = `${colToExcelName(colIndex)}4`;
    if (ws[fieldCellAddress]) ws[fieldCellAddress].s = fieldHeaderStyle;
  });
  if (ws.A1) ws.A1.s = titleStyle;
  if (ws.A2) ws.A2.s = metaStyle;

  const stockFlagIndex = columns.findIndex((col: any) => col.key === 'stock_flag');
  const dataStartRow = 5;
  for (let sheetRow = dataStartRow; sheetRow <= sheetData.length; sheetRow += 1) {
    const dataIndex = sheetRow - dataStartRow;
    const stockFlag = rows[dataIndex]?.stock_flag || '';
    const evenRow = dataIndex % 2 === 1;
    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
      const cellAddress = `${colToExcelName(colIndex)}${sheetRow}`;
      const cell = ws[cellAddress];
      if (!cell) continue;

      if (stockFlag === 'OUT_OF_STOCK' && colIndex === stockFlagIndex) {
        cell.s = outOfStockStyle;
      } else if (stockFlag === 'LOW_STOCK' && colIndex === stockFlagIndex) {
        cell.s = lowStockStyle;
      } else {
        cell.s = evenRow ? zebraStyle : baseDataStyle;
      }
    }
  }

  columns.forEach((col: any, colIndex: number) => {
    for (let rowIndex = 4; rowIndex < sheetData.length; rowIndex++) {
      const address = `${colToExcelName(colIndex)}${rowIndex + 1}`;
      const cell = ws[address];
      if (!cell) continue;
      if (col.type === 'number' && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = '0.00';
      }
      if (String(col.key).includes('_at') && cell.v) {
        cell.t = 's';
      }
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Product Variants');
  return wb;
};
