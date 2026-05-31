const parseBooleanFlag = (value: unknown, fallback: boolean = false): boolean => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
};

export const featureFlags: Readonly<Record<string, boolean>> = Object.freeze({
  SALES_ORDER_V2: parseBooleanFlag(import.meta.env.VITE_SALES_ORDER_V2, true),
});

export const resolveSalesOrderEntry = (flags: Record<string, boolean> = featureFlags): string =>
  flags.SALES_ORDER_V2 ? 'refactor' : 'legacy';

export const isSalesOrderV2Enabled = (flags: Record<string, boolean> = featureFlags): boolean =>
  resolveSalesOrderEntry(flags) === 'refactor';
