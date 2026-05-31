interface ProductVariant {
  status?: unknown;
  [key: string]: unknown;
}

export const isCatalogActiveVariant = (variant: ProductVariant | null | undefined): boolean => {
  const rawStatus = variant?.status;
  if (rawStatus === undefined || rawStatus === null || rawStatus === '') return true;
  if (rawStatus === 1 || rawStatus === true) return true;
  return String(rawStatus).trim().toLowerCase() === 'active';
};

export const findDefaultCatalogActiveVariant = (variants: ProductVariant[] = []): ProductVariant | null =>
  (Array.isArray(variants) ? variants : []).find((variant) => isCatalogActiveVariant(variant)) || null;
