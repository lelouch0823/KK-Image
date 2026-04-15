const OPTION_KEY_ALIASES = {
  color: ['color', '颜色', '顏色'],
  material: ['material', '材质', '材質'],
  size: ['size', '尺码', '尺碼'],
};

function toComparableKey(key) {
  return String(key || '').trim().toLowerCase();
}

function pickValueByAliases(raw = {}, aliases = []) {
  if (!raw || typeof raw !== 'object') return '';
  const entries = Object.entries(raw);
  for (const alias of aliases) {
    const target = toComparableKey(alias);
    const found = entries.find(([key]) => toComparableKey(key) === target);
    if (found && found[1] != null && String(found[1]).trim() !== '') {
      return String(found[1]).trim();
    }
  }
  return '';
}

export function normalizeVariantOptions(raw = {}) {
  return {
    color: pickValueByAliases(raw, OPTION_KEY_ALIASES.color),
    material: pickValueByAliases(raw, OPTION_KEY_ALIASES.material),
    size: pickValueByAliases(raw, OPTION_KEY_ALIASES.size),
  };
}

export function buildVariantDisplayName(raw = {}, fallback = '-') {
  const normalized = normalizeVariantOptions(raw);
  const parts = [normalized.color, normalized.material, normalized.size].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : fallback;
}

export function getVariantAvailabilityState(variant = {}) {
  const status = String(variant.status || '').toLowerCase();
  const stock = Number(variant.stock_quantity ?? variant.stockQuantity ?? 0);
  const alert = Number(variant.alert_threshold ?? variant.alertThreshold ?? 0);

  if (status && status !== 'active') return 'disabled_archived';
  if (stock <= 0) return 'disabled_out_of_stock';
  if (stock <= alert) return 'low_stock';
  return 'available';
}

export function isVariantSelectable(variant = {}) {
  const state = getVariantAvailabilityState(variant);
  return state === 'available' || state === 'low_stock';
}
