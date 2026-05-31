// useProductForm — ProductCreateModal 的表单状态与逻辑层
import { ref, reactive, computed, watch, type Ref, type ComputedRef } from 'vue';
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
import { createProductFormArchiveActions } from '@/composables/product-form/archive-actions.js';
import {
  createActionErrorMessageResolver,
  createProductFormSubmitHandler,
} from '@/composables/product-form/submission.js';

export {
  buildVariantSyncSummaryMessage,
  detectIncompleteVariant,
} from '@/composables/product-form/helpers.js';

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
  barcode?: string;
  supplier_sku?: string;
  price?: number;
  cost_price?: number;
  stock_quantity?: number;
  alert_threshold?: number;
  status: string;
  options_values: Record<string, string>;
  images?: string[];
  _clientKey?: string;
  _incomplete?: boolean;
  [key: string]: unknown;
}

interface ProductForm {
  name: string;
  description: string;
  brand: string;
  series: string;
  category: string;
  currency: string;
  spu: string;
  slug: string;
  images: string[];
  options: ProductOption[];
  variants: ProductVariant[];
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

interface ImageObject {
  id: string;
  url: string;
}

interface TrackedDimension {
  id: string;
  name?: string;
  status?: string;
  values?: Array<{ id?: string; value: string; status?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface UseProductFormOptions {
  editMode: Ref<boolean>;
  initialData: Ref<Record<string, unknown> | null>;
  modelValue?: Ref<boolean> | null;
  emit: (event: string, ...args: unknown[]) => void;
}

/**
 * useProductForm — 商品创建/编辑表单的 composable
 */
export function useProductForm({ editMode, initialData, modelValue = null, emit }: UseProductFormOptions) {
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
  const submitting: Ref<boolean> = ref(false);

  // ——— 子弹窗显示状态 ———
  const showVariantImageManager: Ref<boolean> = ref(false);
  const showVariantBatchBuilder: Ref<boolean> = ref(false);

  // ——— 维度归档向导状态 ———
  const dimensionArchiveWizard: DimensionArchiveWizard = reactive({
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
  const valueArchiveWizard: ValueArchiveWizard = reactive({
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
  const imageObjects: Ref<ImageObject[]> = ref([]);
  const variantLocalKeySeed: Ref<number> = ref(0);
  const trackedDimensions: Ref<TrackedDimension[]> = ref([]);

  // ——— 表单状态 ———
  const form: ProductForm = reactive({
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
  const ensureVariantLocalKeyWithFactory = (variant: ProductVariant = {} as ProductVariant) =>
    ensureVariantLocalKey(variant, nextVariantLocalKey);

  const activeDimensionNames: ComputedRef<string[]> = computed(() =>
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

  const incompleteVariants: ComputedRef<ProductVariant[]> = computed(() =>
    form.variants.filter((variant) => detectIncompleteVariant(activeDimensionNames.value, variant, editMode.value))
  );

  const incompleteVariantCount: ComputedRef<number> = computed(() => incompleteVariants.value.length);

  const incompleteVariantsBannerMessage: ComputedRef<string> = computed(() =>
    t(
      'product.form.incomplete_variants_banner',
      `There are ${incompleteVariantCount.value} legacy variants that no longer match the current specs. Remove/archive them before saving.`
    )
  );

  const resolveActionErrorMessage = createActionErrorMessageResolver({ t });

  const resetArchiveWizards = (): void => {
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

  const invalidateAsyncActions = (): void => {
    asyncActionRequestId += 1;
    resetArchiveWizards();
  };

  const isAsyncActionActive = (requestId: number): boolean =>
    requestId === asyncActionRequestId && (!modelValue || modelValue.value !== false);

  const invalidateSubmitActions = (): void => {
    submitRequestId += 1;
    submitting.value = false;
  };

  const isSubmitActionActive = (requestId: number): boolean =>
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
  function fillFormFromData(data: Record<string, unknown>): void {
    const imgs = parseJsonArray(data.images, []);
    const nextOptions = buildOptionsFromDimensions(data);
    const nextDimensionNames = getNextDimensionNames(nextOptions);
    const dimensionNameLookup = buildDimensionNameLookup(data);
    trackedDimensions.value = cloneDimensions((data?.dimensions as TrackedDimension[]) || []);

    Object.assign(form, {
      name: data.name || '',
      description: data.description || '',
      brand: data.brand || '',
      series: data.series || '',
      category: data.category || '',
      currency: normalizeCurrencyCode(data.currency as string),
      spu: data.spu || '',
      slug: data.slug || '',
      images: imgs,
      options: nextOptions,
      variants: ((data.variants || []) as Record<string, unknown>[]).map((variant) =>
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
    imageObjects.value = (imgs as string[]).map((id) => ({
      id: id,
      url: `/file/${id}`,
    }));
  }

  function resetForm(): void {
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
  const generateVariants = (): void => {
    form.variants = buildGeneratedVariants({
      options: form.options,
      currentVariants: form.variants,
      editMode: editMode.value,
      markVariantCompleteness,
    });
  };

  const updateTrackedDimensionValue = (dimensionId: string, valueLabel: string, updater: (current: Record<string, unknown> | null) => Record<string, unknown> | null): void => {
    const trackedDimension = trackedDimensions.value.find((dimension) => dimension.id === dimensionId);
    if (!trackedDimension) return;

    if (!Array.isArray(trackedDimension.values)) trackedDimension.values = [];
    const existingIndex = trackedDimension.values.findIndex((entry) => entry?.value === valueLabel);
    const currentValue = existingIndex >= 0 ? trackedDimension.values[existingIndex] : null;
    const nextValue = updater(currentValue as Record<string, unknown> | null);
    if (!nextValue) return;

    if (existingIndex >= 0) {
      trackedDimension.values.splice(existingIndex, 1, nextValue as TrackedDimension['values'] extends (infer U)[] ? U : never);
      return;
    }

    trackedDimension.values.push(nextValue as TrackedDimension['values'] extends (infer U)[] ? U : never);
  };

  const findTrackedValueMeta = (dimensionId: string, valueLabel: string) =>
    trackedDimensions.value
      .find((dimension) => dimension.id === dimensionId)
      ?.values?.find((entry) => entry?.value === valueLabel);

  // ——— 选项 CRUD ———
  const addOption = (): void => {
    if (form.options.length >= 3) {
      addToast({ message: t('common.validation_error', '最多 3 个维度'), type: 'error' });
      return;
    }
    form.options.push({ id: null, name: '', values: [], inputValue: '', archivedValues: [] });
  };

  const removeOption = async (idx: number): Promise<void> => {
    const option = form.options[idx];
    if (!option) return;
    if (editMode.value && option.id && initialData.value?.id) {
      const requestId = ++asyncActionRequestId;
      try {
        const impact = await previewDimensionImpact(initialData.value.id as string, {
          action: 'archive_dimension',
          dimensionId: option.id,
        });
        if (!isAsyncActionActive(requestId)) return;
        dimensionArchiveWizard.open = true;
        dimensionArchiveWizard.optionIndex = idx;
        dimensionArchiveWizard.optionId = option.id;
        dimensionArchiveWizard.affectedVariantsCount = (impact as Record<string, unknown>)?.data ? ((impact as Record<string, unknown>).data as Record<string, unknown>).affectedVariantsCount as number ?? 0 : 0;
        const sampleVariants = (impact as Record<string, unknown>)?.data ? ((impact as Record<string, unknown>).data as Record<string, unknown>).sampleVariants : [];
        dimensionArchiveWizard.sampleVariants = Array.isArray(sampleVariants) ? sampleVariants : [];
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
  const addOptionValue = async (opt: ProductOption, extraMeta: Record<string, unknown> | null = null): Promise<void> => {
    if (!opt.inputValue) return;
    const vals = opt.inputValue
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    if (!opt.metaMap) opt.metaMap = {};

    for (const v of vals) {
      if (editMode.value && opt.id && initialData.value?.id) {
        const payload: Record<string, unknown> = { value: v };
        const nextMeta = extraMeta ? { ...opt.metaMap[v], ...extraMeta } : opt.metaMap[v];
        if (nextMeta) payload.meta = nextMeta;

        let response;
        try {
          response = await addDimensionValue(initialData.value.id as string, opt.id, payload);
        } catch (error) {
          if (!modelValue || modelValue.value !== false) {
            addToast({ message: resolveActionErrorMessage(error), type: 'error' });
          }
          continue;
        }
        if (!(response as Record<string, unknown>)?.success) {
          addToast({ message: ((response as Record<string, unknown>)?.error as string) || t('common.operationFailed'), type: 'error' });
          continue;
        }
        if (!opt.values.includes(v)) opt.values.push(v);
        if (extraMeta) opt.metaMap[v] = nextMeta;
        if ((response as Record<string, unknown>)?.data && ((response as Record<string, unknown>).data as Record<string, unknown>)?.id) {
          updateTrackedDimensionValue(opt.id, v, (currentValue) => ({
            ...(currentValue || {}),
            ...((response as Record<string, unknown>).data as Record<string, unknown>),
            value: (((response as Record<string, unknown>).data as Record<string, unknown>)?.value as string) || v,
            status: (((response as Record<string, unknown>).data as Record<string, unknown>)?.status as string) || 'active',
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

  const removeOptionValue = async (opt: ProductOption, vIdx: number): Promise<void> => {
    const value = opt.values[vIdx];
    if (editMode.value && opt.id && initialData.value?.id && value) {
      const valueMeta = findTrackedValueMeta(opt.id, value);
      if (valueMeta?.id) {
        const requestId = ++asyncActionRequestId;
        try {
          const impact = await previewDimensionImpact(initialData.value.id as string, {
            action: 'archive_value',
            valueId: valueMeta.id,
          });
          if (!isAsyncActionActive(requestId)) return;
          valueArchiveWizard.open = true;
          valueArchiveWizard.optionIndex = form.options.indexOf(opt);
          valueArchiveWizard.valueIndex = vIdx;
          valueArchiveWizard.valueId = valueMeta.id as string;
          valueArchiveWizard.valueLabel = value;
          valueArchiveWizard.affectedVariantsCount = (impact as Record<string, unknown>)?.data ? ((impact as Record<string, unknown>).data as Record<string, unknown>).affectedVariantsCount as number ?? 0 : 0;
          const sampleVariants = (impact as Record<string, unknown>)?.data ? ((impact as Record<string, unknown>).data as Record<string, unknown>).sampleVariants : [];
          valueArchiveWizard.sampleVariants = Array.isArray(sampleVariants) ? sampleVariants : [];
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

  const restoreOptionValue = async (opt: ProductOption, archived: Record<string, unknown>, archivedIndex: number): Promise<void> => {
    const valueId = archived?.id as string;
    const value = String(archived?.value || '').trim();
    if (!value) return;

    if (editMode.value && opt.id && initialData.value?.id && valueId) {
      const requestId = ++asyncActionRequestId;
      let response;
      try {
        response = await restoreDimensionValue(initialData.value.id as string, valueId);
      } catch (error) {
        if (!isAsyncActionActive(requestId)) return;
        addToast({ message: resolveActionErrorMessage(error), type: 'error' });
        return;
      }
      if (!isAsyncActionActive(requestId)) return;
      if (!(response as Record<string, unknown>)?.success) {
        addToast({ message: ((response as Record<string, unknown>)?.error as string) || t('common.operationFailed'), type: 'error' });
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

  // ——— 变体辅助 ———
  const formatVariantSample = (sample: Record<string, unknown>): string => {
    const raw = sample?.options_values || {};
    const optionsValues = typeof raw === 'string' ? parseJsonObject(raw, {}) : raw;
    const parts = Object.values(optionsValues as Record<string, unknown> || {})
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const optionLabel = parts.length > 0 ? parts.join(' / ') : (sample?.sku as string) || (sample?.id as string) || '';
    return sample?.sku ? `${sample.sku} · ${optionLabel}` : optionLabel;
  };

  const handleUpdateVariantImages = ({ variantId, variantKey, images }: { variantId?: string; variantKey?: string; images: string[] }): void => {
    const key = String(variantKey || variantId || '').trim();
    const variant = form.variants.find((v) => {
      if (variantId && v.id === variantId) return true;
      return key && (v._clientKey === key || v.id === key);
    });
    if (variant) {
      variant.images = Array.isArray(images) ? images : [];
    }
  };

  const handleBatchBuilderApply = (payload: Record<string, unknown> = {}): void => {
    const result = applyBatchBuilderSelection({
      existingVariants: form.variants,
      options: (payload.options as ProductOption[]) || [],
      variants: (payload.variants as ProductVariant[]) || [],
      buildVariantOptionsKey,
      markVariantCompleteness,
    });
    form.options = result.options as ProductOption[];
    form.variants = result.variants as ProductVariant[];
  };

  const nextAsyncActionRequestId = Object.assign(
    (): number => {
      asyncActionRequestId += 1;
      return asyncActionRequestId;
    },
    { current: () => asyncActionRequestId }
  );

  const nextSubmitRequestId = Object.assign(
    (): number => {
      submitRequestId += 1;
      return submitRequestId;
    },
    { current: () => submitRequestId }
  );

  const {
    closeDimensionArchiveWizard,
    confirmDimensionArchive,
    closeValueArchiveWizard,
    confirmValueArchive,
  } = createProductFormArchiveActions({
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
  });

  const handleSubmit = createProductFormSubmitHandler({
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
  });

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
