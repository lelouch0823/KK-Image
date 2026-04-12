export const isCatalogActiveVariant = (variant) => {
  const rawStatus = variant?.status;
  if (rawStatus === undefined || rawStatus === null || rawStatus === '') return true;
  if (rawStatus === 1 || rawStatus === true) return true;
  return String(rawStatus).trim().toLowerCase() === 'active';
};

export const findDefaultCatalogActiveVariant = (variants = []) =>
  (Array.isArray(variants) ? variants : []).find((variant) => isCatalogActiveVariant(variant)) || null;
