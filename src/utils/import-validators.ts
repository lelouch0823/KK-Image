import { hasEntries } from '@/utils/object-utils';

// --- Constants ---
export const NUMERIC_FIELDS = new Set(['price', 'cost_price', 'stock_quantity', 'alert_threshold']);
export const PRODUCT_FIELDS = new Set([
  'name',
  'spu',
  'currency',
  'category',
  'brand',
  'series',
  'description',
]);
export const VALID_VARIANT_STATUSES = new Set(['active', 'archived']);

// --- Normalizers ---
export const normalizeNumeric = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const normalized = String(value).trim().replace(/,/g, '');
  if (!normalized) return undefined;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
};

export const normalizeStatus = (value) => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'active';
  if (['active', 'enabled', 'on', '1', '上架', '启用'].includes(raw)) return 'active';
  if (['inactive', 'disabled', 'off', '0', '下架', '停用'].includes(raw)) return 'archived';
  if (['archived', 'archive', '归档'].includes(raw)) return 'archived';
  return raw;
};

export const normalizeCurrency = (value) => {
  const raw = String(value || '')
    .trim()
    .toUpperCase();
  if (!raw) return undefined;
  return /^[A-Z]{3}$/.test(raw) ? raw : undefined;
};

export const sanitizeOptionsValues = (value) => {
  if (!value || typeof value !== 'object') return undefined;
  const next = Object.entries(value).reduce((acc, [k, v]) => {
    const key = String(k || '').trim();
    const val = String(v || '').trim();
    if (key && val) acc[key] = val;
    return acc;
  }, {});
  return hasEntries(next) ? next : undefined;
};

export const sanitizeMappedRow = (row) => {
  const clean = {};
  Object.entries(row || {}).forEach(([key, raw]) => {
    if (key === 'options_values') return;
    if (NUMERIC_FIELDS.has(key)) {
      const n = normalizeNumeric(raw);
      if (n !== undefined) clean[key] = n;
      return;
    }
    if (key === 'status') {
      clean.status = normalizeStatus(raw);
      return;
    }
    if (key === 'currency') {
      const normalized = normalizeCurrency(raw);
      if (normalized) clean.currency = normalized;
      return;
    }
    const str = String(raw ?? '').trim();
    if (!str) return;
    clean[key] = str;
  });
  if (!clean.status) clean.status = 'active';

  const optionsValues = sanitizeOptionsValues(row?.options_values);
  if (optionsValues) {
    clean.options_values = optionsValues;
  }
  return clean;
};

// --- Formatters ---
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Stats/Report Factories ---
export const createPreprocessStats = () => ({
  sourceRows: 0,
  acceptedRows: 0,
  droppedEmptyRows: 0,
  normalizedRows: 0,
});

export const createValidationReport = (issues) => {
  const list = Array.isArray(issues) ? issues : [];
  const byCode = list.reduce((acc, issue) => {
    const code = String(issue?.code || 'unknown');
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});
  return {
    total: list.length,
    byCode,
    samples: list.slice(0, 20),
  };
};

// --- Row Validators ---
export const isMeaningfulRow = (item) => {
  const keys = Object.keys(item || {});
  if (keys.length === 0) return false;
  if (keys.length === 1 && keys[0] === 'status') return false;
  return true;
};
