export const CURRENCY_OPTIONS = [
  { code: 'CNY', symbol: '¥', label: '人民币' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: '日本円' },
];

export const CURRENCY_SYMBOLS = Object.fromEntries(
  CURRENCY_OPTIONS.map((currency) => [currency.code, currency.symbol])
);

export const CURRENCY_CODE_SET = new Set(CURRENCY_OPTIONS.map((currency) => currency.code));
