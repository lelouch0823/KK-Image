export const PRODUCT_CURRENCY_CODES = ['CNY', 'USD', 'EUR', 'GBP', 'JPY'];

const PRODUCT_CURRENCY_SET = new Set(PRODUCT_CURRENCY_CODES);

export const normalizeProductCurrency = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!normalized) return 'CNY';
  if (!PRODUCT_CURRENCY_SET.has(normalized)) {
    return null;
  }
  return normalized;
};

export const assertAndNormalizeProductCurrency = (value) => {
  const normalized = normalizeProductCurrency(value);
  if (!normalized) {
    throw new Error(`Invalid currency code. Allowed values: ${PRODUCT_CURRENCY_CODES.join(', ')}`);
  }
  return normalized;
};
