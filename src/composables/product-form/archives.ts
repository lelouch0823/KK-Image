interface ProductVariant {
  id?: string;
  sku: string;
  options_values: Record<string, string>;
  _clientKey?: string;
  _incomplete?: boolean;
  status: string;
  [key: string]: unknown;
}

interface ProductOption {
  id: string | null;
  name: string;
  values: string[];
  inputValue: string;
  archivedValues?: Array<{ id: string; value: string; status: string }>;
  [key: string]: unknown;
}

interface BuildVariantsAfterDimensionArchiveOptions {
  variants?: ProductVariant[];
  archivedOption: ProductOption;
  mode?: string;
  removeDimensionFromVariant: (variant: ProductVariant, option: ProductOption) => ProductVariant;
  getVariantOptionValue: (variant: ProductVariant, option: ProductOption) => string | undefined;
  buildVariantOptionsKey: (optionsValues: Record<string, string>) => string;
  markVariantCompleteness: (variant: ProductVariant, dimensionNames?: string[]) => ProductVariant;
  getNextDimensionNames: () => string[];
}

interface ApplyBatchBuilderSelectionOptions {
  existingVariants?: ProductVariant[];
  options?: Array<{ name: string; values: string[] }>;
  variants?: ProductVariant[];
  buildVariantOptionsKey: (optionsValues: Record<string, string>) => string;
  markVariantCompleteness: (variant: ProductVariant, dimensionNames?: string[]) => ProductVariant;
}

export function buildVariantsAfterDimensionArchive({
  variants = [],
  archivedOption,
  mode = 'archive_variants',
  removeDimensionFromVariant,
  getVariantOptionValue,
  buildVariantOptionsKey,
  markVariantCompleteness,
  getNextDimensionNames,
}: BuildVariantsAfterDimensionArchiveOptions): ProductVariant[] {
  const nextDimensionNames = getNextDimensionNames();

  if (mode === 'merge_keep') {
    const dedupedVariants: ProductVariant[] = [];
    const seenKeys = new Set<string>();

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
}: ApplyBatchBuilderSelectionOptions) {
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
