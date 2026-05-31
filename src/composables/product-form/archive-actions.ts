interface ProductOption {
  id: string | null;
  name: string;
  values: string[];
  inputValue: string;
  archivedValues: Array<{ id: string; value: string; status: string }>;
  metaMap?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ProductVariant {
  id?: string;
  sku: string;
  options_values: Record<string, string>;
  _clientKey?: string;
  _incomplete?: boolean;
  status: string;
  [key: string]: unknown;
}

interface DimensionArchiveWizard {
  open: boolean;
  step: number;
  optionIndex: number;
  optionId: string;
  affectedVariantsCount: number;
  sampleVariants: unknown[];
  mode: string;
  loading: boolean;
}

interface ValueArchiveWizard {
  open: boolean;
  optionIndex: number;
  valueIndex: number;
  valueId: string;
  valueLabel: string;
  affectedVariantsCount: number;
  sampleVariants: unknown[];
  loading: boolean;
}

interface TrackedDimension {
  id: string;
  name?: string;
  status?: string;
  values?: Array<{ id?: string; value: string; status?: string; [key: string]: unknown }>;
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

interface CreateProductFormArchiveActionsOptions {
  initialData: { value: Record<string, unknown> | null };
  form: { options: ProductOption[]; variants: ProductVariant[] };
  trackedDimensions: { value: TrackedDimension[] };
  dimensionArchiveWizard: DimensionArchiveWizard;
  valueArchiveWizard: ValueArchiveWizard;
  addToast: (options: { type: string; message: string }) => void;
  t: (key: string, fallback?: string) => string;
  archiveDimension: (productId: string, dimensionId: string, options: Record<string, unknown>) => Promise<Record<string, unknown>>;
  archiveDimensionValue: (productId: string, valueId: string) => Promise<Record<string, unknown>>;
  nextAsyncActionRequestId: (() => number) & { current: () => number };
  isAsyncActionActive: (requestId: number) => boolean;
  resolveActionErrorMessage: (error: unknown) => string;
  updateTrackedDimensionValue: (dimensionId: string, valueLabel: string, updater: (current: Record<string, unknown> | null) => Record<string, unknown> | null) => void;
  buildVariantsAfterDimensionArchive: (options: BuildVariantsAfterDimensionArchiveOptions) => ProductVariant[];
  removeDimensionFromVariant: (variant: ProductVariant, option: ProductOption) => ProductVariant;
  getVariantOptionValue: (variant: ProductVariant, option: ProductOption) => string | undefined;
  buildVariantOptionsKey: (optionsValues: Record<string, string>) => string;
  markVariantCompleteness: (variant: ProductVariant, dimensionNames?: string[]) => ProductVariant;
  getNextDimensionNames: (options: ProductOption[]) => string[];
}

export function createProductFormArchiveActions({
  initialData,
  form,
  trackedDimensions,
  dimensionArchiveWizard,
  valueArchiveWizard,
  addToast,
  t,
  archiveDimension,
  archiveDimensionValue,
  nextAsyncActionRequestId,
  isAsyncActionActive,
  resolveActionErrorMessage,
  updateTrackedDimensionValue,
  buildVariantsAfterDimensionArchive,
  removeDimensionFromVariant,
  getVariantOptionValue,
  buildVariantOptionsKey,
  markVariantCompleteness,
  getNextDimensionNames,
}: CreateProductFormArchiveActionsOptions) {
  const closeDimensionArchiveWizard = (force = false): void => {
    if (dimensionArchiveWizard.loading && !force) return;
    dimensionArchiveWizard.open = false;
    dimensionArchiveWizard.step = 1;
    dimensionArchiveWizard.optionIndex = -1;
    dimensionArchiveWizard.optionId = '';
    dimensionArchiveWizard.affectedVariantsCount = 0;
    dimensionArchiveWizard.sampleVariants = [];
    dimensionArchiveWizard.mode = 'archive_variants';
  };

  const confirmDimensionArchive = async (): Promise<void> => {
    if (!initialData.value?.id || !dimensionArchiveWizard.optionId) return;
    const requestId = nextAsyncActionRequestId();
    dimensionArchiveWizard.loading = true;
    try {
      const response = await archiveDimension(initialData.value.id as string, dimensionArchiveWizard.optionId, {
        mode: dimensionArchiveWizard.mode,
      });
      if (!isAsyncActionActive(requestId)) return;
      if (!response?.success) {
        addToast({ message: (response?.error as string) || t('common.operationFailed'), type: 'error' });
        return;
      }
      if (dimensionArchiveWizard.optionIndex >= 0) {
        const archivedOption = form.options[dimensionArchiveWizard.optionIndex];
        form.options.splice(dimensionArchiveWizard.optionIndex, 1);
        if (archivedOption?.id) {
          const trackedDimension = trackedDimensions.value.find(
            (dimension) => dimension.id === archivedOption.id
          );
          if (trackedDimension) trackedDimension.status = 'archived';
        }

        form.variants = buildVariantsAfterDimensionArchive({
          variants: form.variants,
          archivedOption,
          mode: dimensionArchiveWizard.mode,
          removeDimensionFromVariant,
          getVariantOptionValue,
          buildVariantOptionsKey,
          markVariantCompleteness,
          getNextDimensionNames: () => getNextDimensionNames(form.options),
        });
      }
      closeDimensionArchiveWizard(true);
    } catch (error) {
      if (!isAsyncActionActive(requestId)) return;
      addToast({ message: resolveActionErrorMessage(error), type: 'error' });
    } finally {
      if (requestId === nextAsyncActionRequestId.current()) {
        dimensionArchiveWizard.loading = false;
      }
    }
  };

  const closeValueArchiveWizard = (force = false): void => {
    if (valueArchiveWizard.loading && !force) return;
    valueArchiveWizard.open = false;
    valueArchiveWizard.optionIndex = -1;
    valueArchiveWizard.valueIndex = -1;
    valueArchiveWizard.valueId = '';
    valueArchiveWizard.valueLabel = '';
    valueArchiveWizard.affectedVariantsCount = 0;
    valueArchiveWizard.sampleVariants = [];
  };

  const confirmValueArchive = async (): Promise<void> => {
    if (!initialData.value?.id || !valueArchiveWizard.valueId) return;
    const requestId = nextAsyncActionRequestId();
    valueArchiveWizard.loading = true;
    try {
      const response = await archiveDimensionValue(initialData.value.id as string, valueArchiveWizard.valueId);
      if (!isAsyncActionActive(requestId)) return;
      if (!response?.success) {
        addToast({ message: (response?.error as string) || t('common.operationFailed'), type: 'error' });
        return;
      }
      if (valueArchiveWizard.optionIndex >= 0 && valueArchiveWizard.valueIndex >= 0) {
        const option = form.options[valueArchiveWizard.optionIndex];
        option?.values?.splice(valueArchiveWizard.valueIndex, 1);
        if (option) {
          if (!Array.isArray(option.archivedValues)) option.archivedValues = [];
          option.archivedValues.push({
            id: valueArchiveWizard.valueId,
            value: valueArchiveWizard.valueLabel,
            status: 'archived',
          });
          updateTrackedDimensionValue(option.id!, valueArchiveWizard.valueLabel, (currentValue) => ({
            ...(currentValue || {}),
            id: valueArchiveWizard.valueId,
            value: valueArchiveWizard.valueLabel,
            status: 'archived',
          }));
        }
        form.variants = form.variants
          .filter((variant) => getVariantOptionValue(variant, option) !== valueArchiveWizard.valueLabel)
          .map((variant) => markVariantCompleteness(variant, getNextDimensionNames(form.options)));
      }
      closeValueArchiveWizard(true);
    } catch (error) {
      if (!isAsyncActionActive(requestId)) return;
      addToast({ message: resolveActionErrorMessage(error), type: 'error' });
    } finally {
      if (requestId === nextAsyncActionRequestId.current()) {
        valueArchiveWizard.loading = false;
      }
    }
  };

  return {
    closeDimensionArchiveWizard,
    confirmDimensionArchive,
    closeValueArchiveWizard,
    confirmValueArchive,
  };
}
