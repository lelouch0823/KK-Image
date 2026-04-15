export const createActionErrorMessageResolver = ({ t }) => (error) =>
  error?.message || error?.error || t('common.operationFailed');

export const normalizeProductFormMutationResult = (result) => {
  if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'success')) {
    return result;
  }
  if (result === null || result === undefined || result === false) {
    return { success: false };
  }
  if (result === true) {
    return { success: true };
  }
  return { success: true, data: result };
};

export function createProductFormSubmitHandler({
  form,
  imageObjects,
  editMode,
  initialData,
  t,
  addToast,
  emit,
  incompleteVariantCount,
  submitting,
  nextSubmitRequestId,
  isSubmitActionActive,
  createProduct,
  updateProduct,
  createProductWithMeta,
  updateProductWithMeta,
  formatSubmittedCurrency,
  isExistingVariantInEditMode,
  buildVariantSyncSummaryMessage,
  resolveActionErrorMessage,
}) {
  return async function handleSubmit() {
    if (!form.name) {
      addToast({
        message: t('common.validation_error', '请填写必填项 (商品名称)'),
        type: 'error',
      });
      return;
    }
    if (!Array.isArray(form.variants) || form.variants.length === 0) {
      addToast({
        message: t('common.validation_error', '请至少添加一个变体'),
        type: 'error',
      });
      return;
    }
    const invalidVariant = form.variants.find(
      (variant) =>
        (!editMode.value && !String(variant.sku || '').trim()) ||
        variant.price === undefined ||
        variant.cost_price === undefined ||
        variant.stock_quantity === undefined ||
        variant.alert_threshold === undefined ||
        !variant.status
    );
    if (invalidVariant) {
      addToast({
        message: t(
          'common.validation_error',
          'Please complete each variant SKU/price/cost/inventory/alert/status'
        ),
        type: 'error',
      });
      return;
    }
    if (incompleteVariantCount.value > 0) {
      addToast({
        message: t(
          'product.form.incomplete_variants_block_submit',
          'Remove or archive incomplete legacy variants before saving'
        ),
        type: 'error',
      });
      return;
    }

    const requestId = nextSubmitRequestId();
    submitting.value = true;
    try {
      const currentImageIds = imageObjects.value.map((file) => file.id).filter(Boolean);
      const payload = {
        name: form.name,
        description: form.description,
        brand: form.brand,
        series: form.series,
        category: form.category,
        currency: formatSubmittedCurrency(form.currency),
        spu: form.spu || undefined,
        slug: form.slug || undefined,
        images: currentImageIds,
        options: form.options.map((option) => ({ name: option.name, values: option.values })),
        dimensions: form.options
          .filter((option) => option.name)
          .map((option) => ({
            id: option.id || undefined,
            name: option.name,
            values: option.values.map((value) => ({
              value,
              meta: option.metaMap?.[value] || undefined,
            })),
          })),
        variants: form.variants.map((variant) => {
          const { _clientKey, _incomplete, ...variantPayload } = variant;
          const payloadVariant = {
            ...variantPayload,
            barcode: String(variant.barcode || '').trim() || null,
            supplier_sku: String(variant.supplier_sku || '').trim() || null,
          };
          if (isExistingVariantInEditMode(editMode, variant)) {
            delete payloadVariant.stock_quantity;
          }
          return payloadVariant;
        }),
      };

      let response;
      if (editMode.value) {
        if (typeof updateProductWithMeta === 'function') {
          response = await updateProductWithMeta(initialData.value.id, payload);
        } else {
          response = await updateProduct(initialData.value.id, payload);
        }
      } else if (typeof createProductWithMeta === 'function') {
        response = await createProductWithMeta(payload);
      } else {
        response = await createProduct(payload);
      }

      const normalized = normalizeProductFormMutationResult(response);
      if (!isSubmitActionActive(requestId)) return;
      if (!normalized.success) {
        addToast({
          message: normalized.error || normalized.message || t('common.operationFailed'),
          type: 'error',
        });
        return;
      }

      if (normalized.variantSync) {
        addToast({
          message: buildVariantSyncSummaryMessage(normalized.variantSync, t),
          type: 'success',
        });
      } else {
        addToast({
          message: editMode.value ? t('common.updated') : t('common.created'),
          type: 'success',
        });
      }

      emit('success', normalized.data || null);
      emit('update:modelValue', false);
    } catch (error) {
      if (!isSubmitActionActive(requestId)) return;
      addToast({
        message: resolveActionErrorMessage(error),
        type: 'error',
      });
    } finally {
      if (requestId === nextSubmitRequestId.current()) {
        submitting.value = false;
      }
    }
  };
}
