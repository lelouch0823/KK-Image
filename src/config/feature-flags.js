const parseBooleanFlag = (value, fallback = false) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
};

export const featureFlags = Object.freeze({
  SALES_ORDER_V2: parseBooleanFlag(import.meta.env.VITE_SALES_ORDER_V2, true),
});

export const resolveSalesOrderEntry = (flags = featureFlags) =>
  flags.SALES_ORDER_V2 ? 'refactor' : 'legacy';

export const isSalesOrderV2Enabled = (flags = featureFlags) =>
  resolveSalesOrderEntry(flags) === 'refactor';
