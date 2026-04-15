// useProductForm — ProductCreateModal 的表单状态与逻辑层
import { ref, reactive, computed, watch } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { parseJsonArray, parseJsonObject } from '@/utils/json.js';
import {
  buildVariantSyncSummaryMessage,
  detectIncompleteVariant,
  formatSubmittedCurrency,
  isExistingVariantInEditMode,
  normalizeCurrencyCode,
} from '@/composables/product-form/helpers.js';
import {
  buildDimensionNameLookup,
  buildOptionsFromDimensions,
  cloneDimensions,
  normalizeVariantOptionKeysToNames,
} from '@/composables/product-form/dimensions.js';
import {
  buildGeneratedVariants,
  buildVariantOptionsKey,
  createVariantCompletenessMarker,
  createVariantLocalKeyFactory,
  ensureVariantLocalKey,
  getNextDimensionNames,
  getVariantOptionValue,
  removeDimensionFromVariant,
} from '@/composables/product-form/variants.js';
import {
  applyBatchBuilderSelection,
  buildVariantsAfterDimensionArchive,
} from '@/composables/product-form/archives.js';

export {
  buildVariantSyncSummaryMessage,
  detectIncompleteVariant,
} from '@/composables/product-form/helpers.js';

/**
 * useProductForm — 商品创建/编辑表单的 composable
 *
 * @param {object} options
 * @param {import('vue').Ref<boolean>} options.editMode - 是否为编辑模式
 * @param {import('vue').Ref<object>} options.initialData - 初始数据（编辑时使用）
 * @param {function} options.emit - 父组件 emit 函数
 * @param {import('vue').Ref<boolean>} [options.modelValue] - 弹窗打开状态
 */
export function useProductForm({ editMode, initialData, modelValue = null, emit }) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const {
    createProduct,
    updateProduct,
    createProductWithMeta,
    updateProductWithMeta,
    archiveDimension,
    previewDimensionImpact,
    addDimensionValue,
    archiveDimensionValue,
    restoreDimensionValue,
  } = useProducts();

  // ——— 提交状态 ———
  const submitting = ref(false);

  // ——— 子弹窗显示状态 ———
  const showVariantImageManager = ref(false);
  const showVariantBatchBuilder = ref(false);

  // ——— 维度归档向导状态 ———
  const dimensionArchiveWizard = reactive({
    open: false,
    step: 1,
    optionIndex: -1,
    optionId: '',
    affectedVariantsCount: 0,
    sampleVariants: [],
    mode: 'archive_variants',
    loading: false,
  });

  // ——— 值归档向导状态 ———
  const valueArchiveWizard = reactive({
    open: false,
    optionIndex: -1,
    valueIndex: -1,
    valueId: '',
    valueLabel: '',
    affectedVariantsCount: 0,
    sampleVariants: [],
    loading: false,
  });
  let asyncActionRequestId = 0;
  let submitRequestId = 0;

  // ——— 图片与变体 key 种子 ———
  const imageObjects = ref([]);
  const variantLocalKeySeed = ref(0);
  const trackedDimensions = ref([]);

  // ——— 表单状态 ———
  const form = reactive({
    name: '',
    description: '',
    brand: '',
    series: '',
    category: '',
    currency: 'CNY',
    spu: '',
    slug: '',
    images: [],
    options: [],
    variants: [],
  });

  // ——— 变体本地 key 辅助 ———
  const nextVariantLocalKey = createVariantLocalKeyFactory(variantLocalKeySeed);
  const ensureVariantLocalKeyWithFactory = (variant = {}) =>
    ensureVariantLocalKey(variant, nextVariantLocalKey);

  const activeDimensionNames = computed(() =>
    form.options
      .map((option) => String(option?.name || '').trim())
      .filter(Boolean)
  );

  const markVariantCompleteness = createVariantCompletenessMarker({
    activeDimensionNamesRef: activeDimensionNames,
    detectIncompleteVariant,
    editModeRef: editMode,
    ensureVariantLocalKey: ensureVariantLocalKeyWithFactory,
  });

  const incompleteVariants = computed(() =>
    form.variants.filter((variant) => detectIncompleteVariant(activeDimensionNames.value, variant, editMode.value))
  );

  const incompleteVariantCount = computed(() => incompleteVariants.value.length);

  const incompleteVariantsBannerMessage = computed(() =>
    t(
      'product.form.incomplete_variants_banner',
      `There are ${incompleteVariantCount.value} legacy variants that no longer match the current specs. Remove/archive them before saving.`
    )
  );

  const resetArchiveWizards = () => {
    dimensionArchiveWizard.open = false;
    dimensionArchiveWizard.step = 1;
    dimensionArchiveWizard.optionIndex = -1;
    dimensionArchiveWizard.optionId = '';
    dimensionArchiveWizard.affectedVariantsCount = 0;
    dimensionArchiveWizard.sampleVariants = [];
    dimensionArchiveWizard.mode = 'archive_variants';
    dimensionArchiveWizard.loading = false;

    valueArchiveWizard.open = false;
    valueArchiveWizard.optionIndex = -1;
    valueArchiveWizard.valueIndex = -1;
    valueArchiveWizard.valueId = '';
    valueArchiveWizard.valueLabel = '';
    valueArchiveWizard.affectedVariantsCount = 0;
    valueArchiveWizard.sampleVariants = [];
    valueArchiveWizard.loading = false;
  };

  const invalidateAsyncActions = () => {
    asyncActionRequestId += 1;
    resetArchiveWizards();
  };

  const isAsyncActionActive = (requestId) =>
    requestId === asyncActionRequestId && (!modelValue || modelValue.value !== false);

  const invalidateSubmitActions = () => {
    submitRequestId += 1;
    submitting.value = false;
  };

  const isSubmitActionActive = (requestId) =>
    requestId === submitRequestId && (!modelValue || modelValue.value !== false);

  if (modelValue) {
    watch(
      [modelValue, () => initialData.value?.id],
      ([isOpen]) => {
        if (!isOpen) {
          invalidateAsyncActions();
          invalidateSubmitActions();
          return;
        }
        asyncActionRequestId += 1;
        submitRequestId += 1;
      },
      { immediate: true }
    );
  }

  // ——— 表单初始化 ———
  function fillFormFromData(data) {
    const imgs = parseJsonArray(data.images, []);
    const nextOptions = buildOptionsFromDimensions(data);
    const nextDimensionNames = getNextDimensionNames(nextOptions);
    const dimensionNameLookup = buildDimensionNameLookup(data);
    trackedDimensions.value = cloneDimensions(data?.dimensions || []);

    Object.assign(form, {
      name: data.name || '',
      description: data.description || '',
      brand: data.brand || '',
      series: data.series || '',
      category: data.category || '',
      currency: normalizeCurrencyCode(data.currency),
      spu: data.spu || '',
      slug: data.slug || '',
      images: imgs,
      options: nextOptions,
      variants: (data.variants || []).map((variant) =>
        markVariantCompleteness({
          ...normalizeVariantOptionKeysToNames(variant, dimensionNameLookup),
          cost_price: variant.cost_price ?? 0,
          alert_threshold: variant.alert_threshold ?? 10,
          status: variant.status || 'active',
          barcode: variant.barcode || '',
          supplier_sku: variant.supplier_sku || '',
          images: Array.isArray(variant.images) ? variant.images : [],
        }, nextDimensionNames)
      ),
    });

    // 同步图片上传器
    imageObjects.value = imgs.map((id) => ({
      id: id,
      url: `/file/${id}`,
    }));
  }

  function resetForm() {
    trackedDimensions.value = [];
    Object.assign(form, {
      name: '',
      description: '',
      brand: '',
      series: '',
      category: '',
      currency: 'CNY',
      spu: '',
      slug: '',
      images: [],
      options: [],
      variants: [],
    });
    imageObjects.value = [];
    variantLocalKeySeed.value = 0;
  }

  // ——— 笛卡尔积生成变体 ———
  const generateVariants = () => {
    form.variants = buildGeneratedVariants({
      options: form.options,
      currentVariants: form.variants,
      editMode: editMode.value,
      markVariantCompleteness,
    });
  };

  const updateTrackedDimensionValue = (dimensionId, valueLabel, updater) => {
    const trackedDimension = trackedDimensions.value.find((dimension) => dimension.id === dimensionId);
    if (!trackedDimension) return;

    if (!Array.isArray(trackedDimension.values)) trackedDimension.values = [];
    const existingIndex = trackedDimension.values.findIndex((entry) => entry?.value === valueLabel);
    const currentValue = existingIndex >= 0 ? trackedDimension.values[existingIndex] : null;
    const nextValue = updater(currentValue);
    if (!nextValue) return;

    if (existingIndex >= 0) {
      trackedDimension.values.splice(existingIndex, 1, nextValue);
      return;
    }

    trackedDimension.values.push(nextValue);
  };

  const findTrackedValueMeta = (dimensionId, valueLabel) =>
    trackedDimensions.value
      .find((dimension) => dimension.id === dimensionId)
      ?.values?.find((entry) => entry?.value === valueLabel);

  // ——— 选项 CRUD ———
  const addOption = () => {
    if (form.options.length >= 3) {
      addToast({ message: t('common.validation_error', '最多 3 个维度'), type: 'error' });
      return;
    }
    form.options.push({ id: null, name: '', values: [], inputValue: '', archivedValues: [] });
  };

  const removeOption = async (idx) => {
    const option = form.options[idx];
    if (!option) return;
    if (editMode.value && option.id && initialData.value?.id) {
      const requestId = ++asyncActionRequestId;
      try {
        const impact = await previewDimensionImpact(initialData.value.id, {
          action: 'archive_dimension',
          dimensionId: option.id,
        });
        if (!isAsyncActionActive(requestId)) return;
        dimensionArchiveWizard.open = true;
        dimensionArchiveWizard.optionIndex = idx;
        dimensionArchiveWizard.optionId = option.id;
        dimensionArchiveWizard.affectedVariantsCount = impact?.data?.affectedVariantsCount ?? 0;
        dimensionArchiveWizard.sampleVariants = Array.isArray(impact?.data?.sampleVariants)
          ? impact.data.sampleVariants
          : [];
        dimensionArchiveWizard.mode = 'archive_variants';
        dimensionArchiveWizard.step = 1;
      } catch (error) {
        if (!isAsyncActionActive(requestId)) return;
        addToast({ message: resolveActionErrorMessage(error), type: 'error' });
      }
      return;
    }
    form.options.splice(idx, 1);
    generateVariants();
  };

  // ——— 选项值 CRUD ———
  const addOptionValue = async (opt, extraMeta = null) => {
    if (!opt.inputValue) return;
    const vals = opt.inputValue
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    if (!opt.metaMap) opt.metaMap = {};

    for (const v of vals) {
      if (editMode.value && opt.id && initialData.value?.id) {
        const payload = { value: v };
        const nextMeta = extraMeta ? { ...opt.metaMap[v], ...extraMeta } : opt.metaMap[v];
        if (nextMeta) payload.meta = nextMeta;

        let response;
        try {
          response = await addDimensionValue(initialData.value.id, opt.id, payload);
        } catch (error) {
          if (!modelValue || modelValue.value !== false) {
            addToast({ message: resolveActionErrorMessage(error), type: 'error' });
          }
          continue;
        }
        if (!response?.success) {
          addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
          continue;
        }
        if (!opt.values.includes(v)) opt.values.push(v);
        if (extraMeta) opt.metaMap[v] = nextMeta;
        if (response?.data?.id) {
          updateTrackedDimensionValue(opt.id, v, (currentValue) => ({
            ...(currentValue || {}),
            ...response.data,
            value: response.data?.value || v,
            status: response.data?.status || 'active',
          }));
        }
        continue;
      }
      if (!opt.values.includes(v)) opt.values.push(v);
      if (extraMeta) opt.metaMap[v] = { ...opt.metaMap[v], ...extraMeta };
    }
    opt.inputValue = '';
    generateVariants();
  };

  const removeOptionValue = async (opt, vIdx) => {
    const value = opt.values[vIdx];
    if (editMode.value && opt.id && initialData.value?.id && value) {
      const valueMeta = findTrackedValueMeta(opt.id, value);
      if (valueMeta?.id) {
        const requestId = ++asyncActionRequestId;
        try {
          const impact = await previewDimensionImpact(initialData.value.id, {
            action: 'archive_value',
            valueId: valueMeta.id,
          });
          if (!isAsyncActionActive(requestId)) return;
          valueArchiveWizard.open = true;
          valueArchiveWizard.optionIndex = form.options.indexOf(opt);
          valueArchiveWizard.valueIndex = vIdx;
          valueArchiveWizard.valueId = valueMeta.id;
          valueArchiveWizard.valueLabel = value;
          valueArchiveWizard.affectedVariantsCount = impact?.data?.affectedVariantsCount ?? 0;
          valueArchiveWizard.sampleVariants = Array.isArray(impact?.data?.sampleVariants)
            ? impact.data.sampleVariants
            : [];
        } catch (error) {
          if (!isAsyncActionActive(requestId)) return;
          addToast({ message: resolveActionErrorMessage(error), type: 'error' });
        }
        return;
      }
    }
    opt.values.splice(vIdx, 1);
    generateVariants();
  };

  const restoreOptionValue = async (opt, archived, archivedIndex) => {
    const valueId = archived?.id;
    const value = String(archived?.value || '').trim();
    if (!value) return;

    if (editMode.value && opt.id && initialData.value?.id && valueId) {
      const requestId = ++asyncActionRequestId;
      let response;
      try {
        response = await restoreDimensionValue(initialData.value.id, valueId);
      } catch (error) {
        if (!isAsyncActionActive(requestId)) return;
        addToast({ message: resolveActionErrorMessage(error), type: 'error' });
        return;
      }
      if (!isAsyncActionActive(requestId)) return;
      if (!response?.success) {
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
        return;
      }
      updateTrackedDimensionValue(opt.id, value, (currentValue) => ({
        ...(currentValue || archived || {}),
        id: valueId,
        value,
        status: 'active',
      }));
    }

    if (!opt.values.includes(value)) opt.values.push(value);
    if (Array.isArray(opt.archivedValues) && archivedIndex >= 0) {
      opt.archivedValues.splice(archivedIndex, 1);
    }
    generateVariants();
  };

  // ——— 维度归档向导 ———
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
    const requestId = ++asyncActionRequestId;
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
          const trackedDimension = trackedDimensions.value.find((dimension) => dimension.id === archivedOption.id);
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
      if (requestId === asyncActionRequestId) {
        dimensionArchiveWizard.loading = false;
      }
    }
  };

  // ——— 值归档向导 ———
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
    const requestId = ++asyncActionRequestId;
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
      if (requestId === asyncActionRequestId) {
        valueArchiveWizard.loading = false;
      }
    }
  };

  // ——— 变体辅助 ———
  const formatVariantSample = (sample) => {
    const raw = sample?.options_values || {};
    const optionsValues = typeof raw === 'string' ? parseJsonObject(raw, {}) : raw;
    const parts = Object.values(optionsValues || {})
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const optionLabel = parts.length > 0 ? parts.join(' / ') : sample?.sku || sample?.id || '';
    return sample?.sku ? `${sample.sku} · ${optionLabel}` : optionLabel;
  };

  const handleUpdateVariantImages = ({ variantId, variantKey, images }) => {
    const key = String(variantKey || variantId || '').trim();
    const variant = form.variants.find((v) => {
      if (variantId && v.id === variantId) return true;
      return key && (v._clientKey === key || v.id === key);
    });
    if (variant) {
      variant.images = Array.isArray(images) ? images : [];
    }
  };

  const handleBatchBuilderApply = (payload = {}) => {
    const result = applyBatchBuilderSelection({
      existingVariants: form.variants,
      options: payload.options || [],
      variants: payload.variants || [],
      buildVariantOptionsKey,
      markVariantCompleteness,
    });
    form.options = result.options;
    form.variants = result.variants;
  };

  // ——— 表单提交 ———
  const normalizeMutationResult = (result) => {
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

  const resolveActionErrorMessage = (error) =>
    error?.message || error?.error || t('common.operationFailed');

  const handleSubmit = async () => {
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
        message: t('common.validation_error', 'Please complete each variant SKU/price/cost/inventory/alert/status'),
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

    const requestId = ++submitRequestId;
    submitting.value = true;
    try {
      // 从图片上传器中提取 ID
      const currentImageIds = imageObjects.value.map((f) => f.id).filter(Boolean);

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
        options: form.options.map((o) => ({ name: o.name, values: o.values })),
        dimensions: form.options
          .filter((option) => option.name)
          .map((option) => ({
            id: option.id || undefined,
            name: option.name,
            values: option.values.map(val => ({
                 value: val,
                 meta: option.metaMap?.[val] || undefined
            })),
          })),
        variants: form.variants.map((variant) => {
          const { _clientKey, _incomplete, ...variantPayload } = variant;
          const payload = {
            ...variantPayload,
            barcode: String(variant.barcode || '').trim() || null,
            supplier_sku: String(variant.supplier_sku || '').trim() || null,
          };
          if (isExistingVariantInEditMode(editMode, variant)) {
            delete payload.stock_quantity;
          }
          return payload;
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

      const normalized = normalizeMutationResult(response);
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

      if (normalized.success) {
        emit('success', normalized.data || null);
        emit('update:modelValue', false);
      }
    } catch (error) {
      if (!isSubmitActionActive(requestId)) return;
      addToast({
        message: error?.message || error?.error || t('common.operationFailed'),
        type: 'error',
      });
    } finally {
      if (requestId === submitRequestId) {
        submitting.value = false;
      }
    }
  };

  return {
    // 状态
    form,
    imageObjects,
    submitting,
    showVariantImageManager,
    showVariantBatchBuilder,
    dimensionArchiveWizard,
    valueArchiveWizard,
    // 方法
    resetForm,
    fillFormFromData,
    addOption,
    removeOption,
    addOptionValue,
    removeOptionValue,
    restoreOptionValue,
    closeDimensionArchiveWizard,
    confirmDimensionArchive,
    closeValueArchiveWizard,
    confirmValueArchive,
    generateVariants,
    formatVariantSample,
    handleUpdateVariantImages,
    handleBatchBuilderApply,
    handleSubmit,
    variantOptionsKey: buildVariantOptionsKey,
    ensureVariantLocalKey: ensureVariantLocalKeyWithFactory,
    incompleteVariants,
    incompleteVariantCount,
    incompleteVariantsBannerMessage,
  };
}
