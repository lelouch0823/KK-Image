import { formatReadableLabel } from './event-display';

type TranslateFn = (key: string, fallback?: string) => string;

const CUSTOMER_SEGMENT_KEYS: Record<string, string> = {
  active: 'Active',
  'at-risk': 'AtRisk',
  lost: 'Lost',
  new: 'New',
  vip: 'Vip',
};

const FILE_TYPE_LABELS: Record<string, string> = {
  audio: 'Audio',
  document: 'Document',
  image: 'Image',
  other: 'Other',
  pdf: 'PDF',
  video: 'Video',
  'application/msword': 'Word Document',
  'application/pdf': 'PDF',
  'application/vnd.ms-excel': 'Excel Spreadsheet',
  'application/vnd.ms-powerpoint': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
  'text/csv': 'CSV',
  'text/plain': 'Text',
};

const FILE_SUBTYPE_LABELS: Record<string, string> = {
  csv: 'CSV',
  gif: 'GIF',
  jpeg: 'JPEG',
  jpg: 'JPEG',
  json: 'JSON',
  pdf: 'PDF',
  png: 'PNG',
  svg: 'SVG',
  'svg+xml': 'SVG',
  webp: 'WEBP',
  xml: 'XML',
};

function translateWithFallback(t: TranslateFn, key: string, fallback: string): string {
  const translated = t(key, fallback);
  return translated && translated !== key ? translated : fallback;
}

export function formatProductStatusLabel(t: TranslateFn, status: unknown): string {
  const raw = String(status || 'archived').trim();
  return translateWithFallback(t, `product.filters.status.${raw}`, formatReadableLabel(raw));
}

export function formatStocktakeStatusLabel(t: TranslateFn, status: unknown): string {
  const raw = String(status || '').trim();
  return translateWithFallback(t, `stocktake.status.${raw}`, formatReadableLabel(raw));
}

export function formatOrderStatusLabel(t: TranslateFn, status: unknown): string {
  const raw = String(status || '').trim();
  return translateWithFallback(t, `order.statuses.${raw}`, formatReadableLabel(raw));
}

export function formatOrderProcurementStatusLabel(t: TranslateFn, status: unknown): string {
  const raw = String(status || '').trim();
  return translateWithFallback(t, `order.procurementStatuses.${raw}`, formatReadableLabel(raw));
}

export function formatOrderDeliveryStatusLabel(t: TranslateFn, status: unknown): string {
  const raw = String(status || '').trim();
  return translateWithFallback(t, `order.deliveryStatuses.${raw}`, formatReadableLabel(raw));
}

export function formatOrderCostSourceLabel(t: TranslateFn, source: unknown): string {
  const raw = String(source || '').trim();
  return translateWithFallback(t, `order.profit.costSources.${raw}`, formatReadableLabel(raw));
}

export function formatCustomerSegmentLabel(t: TranslateFn, segment: unknown): string {
  const raw = String(segment || '').trim();
  const key = CUSTOMER_SEGMENT_KEYS[raw];
  if (!key) return formatReadableLabel(raw);
  return translateWithFallback(t, `customer.detail.segment${key}`, formatReadableLabel(raw));
}

export function formatCustomerSegmentDescription(t: TranslateFn, segment: unknown): string {
  const raw = String(segment || '').trim();
  const key = CUSTOMER_SEGMENT_KEYS[raw];
  if (!key) return '';
  return translateWithFallback(t, `customer.detail.segment${key}Desc`, '');
}

export function formatFileTypeLabel(type: unknown): string {
  const raw = String(type || '').trim();
  if (!raw) return 'Unknown';
  const normalized = raw.toLowerCase();
  if (FILE_TYPE_LABELS[normalized]) return FILE_TYPE_LABELS[normalized];

  const subtype = normalized.includes('/') ? normalized.split('/').pop() || normalized : normalized;
  if (FILE_SUBTYPE_LABELS[subtype]) return FILE_SUBTYPE_LABELS[subtype];

  return formatReadableLabel(subtype.replace(/^vnd[.-]/, '').replace(/^x[.-]/, ''));
}
