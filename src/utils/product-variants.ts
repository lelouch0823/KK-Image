export const isCatalogActiveVariant = (variant: any): boolean => {
  const rawStatus = variant?.status;
  if (rawStatus === undefined || rawStatus === null || rawStatus === '') return true;
  if (rawStatus === 1 || rawStatus === true) return true;
  return String(rawStatus).trim().toLowerCase() === 'active';
};

export const findDefaultCatalogActiveVariant = (variants: any[] = []): any =>
  (Array.isArray(variants) ? variants : []).find((variant) => isCatalogActiveVariant(variant)) || null;
