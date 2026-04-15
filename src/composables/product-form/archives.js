export function buildVariantsAfterDimensionArchive({
  variants = [],
  archivedOption,
  mode = 'archive_variants',
  removeDimensionFromVariant,
  getVariantOptionValue,
  buildVariantOptionsKey,
  markVariantCompleteness,
  getNextDimensionNames,
}) {
  const nextDimensionNames = getNextDimensionNames();

  if (mode === 'merge_keep') {
    const dedupedVariants = [];
    const seenKeys = new Set();

    for (const variant of variants) {
      const nextVariant = removeDimensionFromVariant(variant, archivedOption);
      const key = buildVariantOptionsKey(nextVariant.options_values);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      dedupedVariants.push(nextVariant);
    }

    return dedupedVariants.map((variant) =>
      markVariantCompleteness(variant, nextDimensionNames)
    );
  }

  return variants
    .filter((variant) => getVariantOptionValue(variant, archivedOption) === undefined)
    .map((variant) => markVariantCompleteness(variant, nextDimensionNames));
}

export function applyBatchBuilderSelection({
  existingVariants = [],
  options = [],
  variants = [],
  buildVariantOptionsKey,
  markVariantCompleteness,
}) {
  const normalizedOptions = options.map((option) => ({
    name: option.name,
    values: Array.isArray(option.values) ? option.values : [],
    inputValue: '',
  }));

  const mergedVariants = [...existingVariants];
  const existingMap = new Map(
    existingVariants.map((variant) => [
      buildVariantOptionsKey(variant.options_values),
      variant,
    ])
  );

  for (const variant of variants) {
    const key = buildVariantOptionsKey(variant.options_values);
    if (existingMap.has(key)) continue;
    const optionsValues = variant.options_values || {};
    const normalizedVariant = {
      ...markVariantCompleteness(variant),
      sku: String(variant.sku || ''),
      options_values: optionsValues,
    };
    mergedVariants.push(normalizedVariant);
    existingMap.set(key, normalizedVariant);
  }

  return {
    options: normalizedOptions,
    variants: mergedVariants,
  };
}
