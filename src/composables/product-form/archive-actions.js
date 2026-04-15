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
}) {
  const closeDimensionArchiveWizard = (force = false) => {
    if (dimensionArchiveWizard.loading && !force) return;
    dimensionArchiveWizard.open = false;
    dimensionArchiveWizard.step = 1;
    dimensionArchiveWizard.optionIndex = -1;
    dimensionArchiveWizard.optionId = '';
    dimensionArchiveWizard.affectedVariantsCount = 0;
    dimensionArchiveWizard.sampleVariants = [];
    dimensionArchiveWizard.mode = 'archive_variants';
  };

  const confirmDimensionArchive = async () => {
    if (!initialData.value?.id || !dimensionArchiveWizard.optionId) return;
    const requestId = nextAsyncActionRequestId();
    dimensionArchiveWizard.loading = true;
    try {
      const response = await archiveDimension(initialData.value.id, dimensionArchiveWizard.optionId, {
        mode: dimensionArchiveWizard.mode,
      });
      if (!isAsyncActionActive(requestId)) return;
      if (!response?.success) {
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
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

  const closeValueArchiveWizard = (force = false) => {
    if (valueArchiveWizard.loading && !force) return;
    valueArchiveWizard.open = false;
    valueArchiveWizard.optionIndex = -1;
    valueArchiveWizard.valueIndex = -1;
    valueArchiveWizard.valueId = '';
    valueArchiveWizard.valueLabel = '';
    valueArchiveWizard.affectedVariantsCount = 0;
    valueArchiveWizard.sampleVariants = [];
  };

  const confirmValueArchive = async () => {
    if (!initialData.value?.id || !valueArchiveWizard.valueId) return;
    const requestId = nextAsyncActionRequestId();
    valueArchiveWizard.loading = true;
    try {
      const response = await archiveDimensionValue(initialData.value.id, valueArchiveWizard.valueId);
      if (!isAsyncActionActive(requestId)) return;
      if (!response?.success) {
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
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
          updateTrackedDimensionValue(option.id, valueArchiveWizard.valueLabel, (currentValue) => ({
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
