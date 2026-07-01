// useProductForm - ProductCreateModal 的表单状态与逻辑层
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
  type Dimension,
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
import { createProductFormOptions } from '@/composables/product-form/useProductFormOptions.js';
import type {
  ProductOption,
  ProductVariant,
  ProductForm,
  DimensionArchiveWizard,
  ValueArchiveWizard,
  ImageObject,
  TrackedDimension,
  UseProductFormOptions,
} from './product-form/product-form-types';

export {
  buildVariantSyncSummaryMessage,
  detectIncompleteVariant,
} from '@/composables/product-form/helpers.js';

/**
 * useProductForm - 商品创建/编辑表单的 composable
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

  // --- 提交状态 ---
  const submitting: Ref<boolean> = ref(false);

  // --- 子弹窗显示状态 ---
  const showVariantImageManager: Ref<boolean> = ref(false);
  const showVariantBatchBuilder: Ref<boolean> = ref(false);

  // --- 维度归档向导状态 ---
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

  // --- 值归档向导状态 ---
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

  // --- 图片与变体 key 种子 ---
  const imageObjects: Ref<ImageObject[]> = ref([]);
  const variantLocalKeySeed: Ref<number> = ref(0);
  const trackedDimensions: Ref<TrackedDimension[]> = ref([]);

  // --- 表单状态 ---
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

  // --- 变体本地 key 辅助 ---
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

  // --- 表单初始化 ---
  function fillFormFromData(data: Record<string, unknown>): void {
    const imgs = parseJsonArray(data.images, []);
    const nextOptions = buildOptionsFromDimensions(data);
    const nextDimensionNames = getNextDimensionNames(nextOptions as ProductOption[]);
    const dimensionNameLookup = buildDimensionNameLookup(data);
    trackedDimensions.value = cloneDimensions((data?.dimensions as Dimension[]) || []) as TrackedDimension[];

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
          cost_price: (variant.cost_price as number) ?? 0,
          alert_threshold: (variant.alert_threshold as number) ?? 10,
          status: (variant.status as string) || 'active',
          barcode: (variant.barcode as string) || '',
          supplier_sku: (variant.supplier_sku as string) || '',
          images: Array.isArray(variant.images) ? variant.images : [],
        } as ProductVariant, nextDimensionNames)
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

  // --- 笛卡尔积生成变体 ---
  const generateVariants = (): void => {
    form.variants = buildGeneratedVariants({
      options: form.options,
      currentVariants: form.variants,
      editMode: editMode.value,
      markVariantCompleteness,
    });
  };

  // --- 选项 CRUD（提取至 useProductFormOptions） ---
  const nextAsyncActionRequestId = Object.assign(
    (): number => {
      asyncActionRequestId += 1;
      return asyncActionRequestId;
    },
    { current: () => asyncActionRequestId }
  );

  const {
    addOption,
    removeOption,
    addOptionValue,
    removeOptionValue,
    restoreOptionValue,
    updateTrackedDimensionValue,
  } = createProductFormOptions({
    form,
    editMode,
    initialData,
    modelValue,
    trackedDimensions,
    dimensionArchiveWizard,
    valueArchiveWizard,
    addToast,
    t,
    previewDimensionImpact,
    addDimensionValue,
    restoreDimensionValue,
    resolveActionErrorMessage,
    generateVariants,
    nextAsyncActionRequestId,
    isAsyncActionActive,
  });

  // --- 变体辅助 ---
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
