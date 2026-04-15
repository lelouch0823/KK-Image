export function createVariantLocalKeyFactory(seedRef) {
  return () => {
    seedRef.value += 1;
    return `variant_local_${seedRef.value}`;
  };
}

export function ensureVariantLocalKey(variant = {}, nextVariantLocalKey) {
  return {
    ...variant,
    _clientKey: variant._clientKey || variant.id || nextVariantLocalKey(),
  };
}

export function createVariantCompletenessMarker({
  activeDimensionNamesRef,
  detectIncompleteVariant,
  editModeRef,
  ensureVariantLocalKey: ensureVariantLocalKeyWithFactory,
}) {
  return (variant = {}, dimensionNames = activeDimensionNamesRef.value) => {
    const normalized = ensureVariantLocalKeyWithFactory(variant);
    if (detectIncompleteVariant(dimensionNames, normalized, editModeRef.value)) {
      return {
        ...normalized,
        status: 'pending_incomplete',
        _incomplete: true,
      };
    }

    if (normalized.status === 'pending_incomplete') {
      return {
        ...normalized,
        status: 'active',
        _incomplete: false,
      };
    }

    return {
      ...normalized,
      _incomplete: false,
    };
  };
}

export function buildVariantOptionsKey(optionsValues) {
  return JSON.stringify(
    Object.keys(optionsValues || {})
      .sort()
      .reduce((acc, key) => {
        acc[key] = optionsValues[key];
        return acc;
      }, {})
  );
}

export function getNextDimensionNames(options = []) {
  return options
    .map((option) => String(option?.name || '').trim())
    .filter(Boolean);
}

export function getVariantOptionValue(variant, option) {
  const optionsValues = variant?.options_values || {};
  if (option?.id && Object.prototype.hasOwnProperty.call(optionsValues, option.id)) {
    return optionsValues[option.id];
  }
  if (option?.name && Object.prototype.hasOwnProperty.call(optionsValues, option.name)) {
    return optionsValues[option.name];
  }
  return undefined;
}

export function removeDimensionFromVariant(variant, option) {
  const nextOptionsValues = { ...(variant?.options_values || {}) };
  if (option?.id) delete nextOptionsValues[option.id];
  if (option?.name) delete nextOptionsValues[option.name];
  return {
    ...variant,
    options_values: nextOptionsValues,
  };
}

export function buildGeneratedVariants({
  options = [],
  currentVariants = [],
  editMode = false,
  markVariantCompleteness,
}) {
  const validOptions = options.filter((option) => option.name && option.values.length > 0);
  const dimensionNames = getNextDimensionNames(validOptions);

  if (validOptions.length === 0) {
    return [];
  }

  const cartesian = validOptions.reduce(
    (acc, option) => {
      const result = [];
      acc.forEach((previous) => {
        option.values.forEach((value) => {
          result.push({ ...previous, [option.name]: value });
        });
      });
      return result;
    },
    [{}]
  );

  const oldVariantsMap = new Map();
  currentVariants.forEach((variant) => {
    const key = buildVariantOptionsKey(variant.options_values);
    oldVariantsMap.set(key, variant);
  });

  const generatedVariants = cartesian.map((combo) => {
    const key = buildVariantOptionsKey(combo);
    const old = oldVariantsMap.get(key);
    if (old) return markVariantCompleteness(old, dimensionNames);

    return markVariantCompleteness({
      sku: '',
      barcode: '',
      supplier_sku: '',
      price: 0,
      cost_price: 0,
      stock_quantity: 0,
      alert_threshold: 10,
      options_values: combo,
      status: 'active',
      images: [],
    }, dimensionNames);
  });

  if (!editMode) {
    return generatedVariants;
  }

  const generatedKeys = new Set(
    generatedVariants.map((variant) => buildVariantOptionsKey(variant.options_values))
  );
  const preservedExistingVariants = currentVariants
    .filter((variant) => {
      if (!variant?.id) return false;
      return !generatedKeys.has(buildVariantOptionsKey(variant.options_values));
    })
    .map((variant) => markVariantCompleteness(variant, dimensionNames));

  return [...preservedExistingVariants, ...generatedVariants].map((variant) =>
    markVariantCompleteness(variant, dimensionNames)
  );
}
