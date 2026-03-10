// useProductForm — ProductCreateModal 的表单状态与逻辑层
import { ref, reactive } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { buildVariantSku } from '@/components/product/variant-sku.js';

// 货币配置常量
export const CURRENCY_OPTIONS = [
  { code: 'CNY', symbol: '¥', label: '人民币' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: '日本円' },
];
export const CURRENCY_SYMBOLS = Object.fromEntries(CURRENCY_OPTIONS.map((c) => [c.code, c.symbol]));
const CURRENCY_CODE_SET = new Set(CURRENCY_OPTIONS.map((c) => c.code));

/**
 * 规范化货币代码，若无效则默认 CNY
 */
function normalizeCurrencyCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return CURRENCY_CODE_SET.has(code) ? code : 'CNY';
}

function isExistingVariantInEditMode(editModeRef, variant) {
  return Boolean(editModeRef?.value && variant?.id);
}

/**
 * 安全解析 JSON 字符串
 */
function parseJson(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str || null;
  } catch {
    return null;
  }
}

function translateWithFallback(translate, key, params, fallback) {
  const resolved = typeof translate === 'function' ? translate(key, params) : '';
  if (!resolved || resolved === key) return fallback;
  return resolved;
}

export function buildVariantSyncSummaryMessage(sync = {}, translate) {
  const created = Math.max(0, Number(sync.created ?? 0));
  const updated = Math.max(0, Number(sync.updated ?? 0));
  const archived = Math.max(0, Number(sync.archived ?? 0));
  const reactivated = Math.max(0, Number(sync.reactivated ?? 0));

  const parts = [];
  if (created > 0) {
    parts.push(
      translateWithFallback(
        translate,
        'product.form.variant_sync_created',
        { count: created },
        `Created ${created} variants`
      )
    );
  }
  if (updated > 0) {
    parts.push(
      translateWithFallback(
        translate,
        'product.form.variant_sync_updated',
        { count: updated },
        `Updated ${updated} variants`
      )
    );
  }
  if (archived > 0) {
    parts.push(
      translateWithFallback(
        translate,
        'product.form.variant_sync_archived',
        { count: archived },
        `Archived ${archived} variants`
      )
    );
  }
  if (reactivated > 0) {
    parts.push(
      translateWithFallback(
        translate,
        'product.form.variant_sync_reactivated',
        { count: reactivated },
        `Reactivated ${reactivated} variants`
      )
    );
  }

  if (parts.length === 0) {
    return translateWithFallback(
      translate,
      'product.form.variant_sync_no_changes',
      {},
      'Variants synced with no quantity changes'
    );
  }

  return translateWithFallback(
    translate,
    'product.form.variant_sync_summary_readable',
    { details: parts.join('，') },
    `Variants synced: ${parts.join(', ')}`
  );
}

/**
 * 将原始 option 数据转换为表单模型
 */
function toOptionModel(raw = {}) {
  const values = [];
  const metaMap = {};

  if (Array.isArray(raw.values)) {
    raw.values.forEach(entry => {
       const val = typeof entry === 'string' ? entry : entry?.value;
       const cleanVal = String(val || '').trim();
       if (cleanVal && entry?.status !== 'archived') {
          values.push(cleanVal);
          if (entry?.meta) {
              const metaObj = typeof entry.meta === 'string' ? parseJson(entry.meta) : entry.meta;
              if (metaObj) metaMap[cleanVal] = metaObj;
          }
       }
    });
  }

  return {
    id: raw.id || null,
    name: String(raw.name || '').trim(),
    values: [...new Set(values)],
    metaMap,
    inputValue: '',
    archivedValues: Array.isArray(raw.values)
      ? raw.values.filter(
          (entry) => entry && typeof entry === 'object' && entry.status === 'archived'
        )
      : [],
  };
}

/**
 * 从产品数据构建选项数组
 */
function buildOptionsFromDimensions(data) {
  if (Array.isArray(data?.dimensions) && data.dimensions.length > 0) {
    return data.dimensions
      .map((dimension) =>
        toOptionModel({
          id: dimension.id,
          name: dimension.name,
          values: (dimension.values || []).filter((value) => value.status !== 'archived'),
        })
      )
      .filter((dimension) => dimension.name);
  }
  return (parseJson(data?.options) || []).map((option) => toOptionModel(option));
}

/**
 * useProductForm — 商品创建/编辑表单的 composable
 *
 * @param {object} options
 * @param {import('vue').Ref<boolean>} options.editMode - 是否为编辑模式
 * @param {import('vue').Ref<object>} options.initialData - 初始数据（编辑时使用）
 * @param {function} options.emit - 父组件 emit 函数
 */
export function useProductForm({ editMode, initialData, emit }) {
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

  // ——— 图片与变体 key 种子 ———
  const imageObjects = ref([]);
  const variantLocalKeySeed = ref(0);

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
  const nextVariantLocalKey = () => {
    variantLocalKeySeed.value += 1;
    return `variant_local_${variantLocalKeySeed.value}`;
  };

  const ensureVariantLocalKey = (variant = {}) => ({
    ...variant,
    _clientKey: variant._clientKey || variant.id || nextVariantLocalKey(),
  });

  // ——— 表单初始化 ———
  function fillFormFromData(data) {
    const imgs = parseJson(data.images) || [];

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
      options: buildOptionsFromDimensions(data),
      variants: (data.variants || []).map((variant) =>
        ensureVariantLocalKey({
          ...variant,
          cost_price: variant.cost_price ?? 0,
          alert_threshold: variant.alert_threshold ?? 10,
          status: variant.status || 'active',
          barcode: variant.barcode || '',
          supplier_sku: variant.supplier_sku || '',
          images: Array.isArray(variant.images) ? variant.images : [],
        })
      ),
    });

    // 同步图片上传器
    imageObjects.value = imgs.map((id) => ({
      id: id,
      url: `/file/${id}`,
    }));
  }

  function resetForm() {
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
    const validOptions = form.options.filter((o) => o.name && o.values.length > 0);
    if (validOptions.length === 0) {
      form.variants = [];
      return;
    }

    const cartesian = validOptions.reduce(
      (acc, opt) => {
        const res = [];
        acc.forEach((oldObj) => {
          opt.values.forEach((val) => {
            res.push({ ...oldObj, [opt.name]: val });
          });
        });
        return res;
      },
      [{}]
    );

    const oldVariantsMap = new Map();
    form.variants.forEach((v) => {
      const key = JSON.stringify(v.options_values);
      oldVariantsMap.set(key, v);
    });

    form.variants = cartesian.map((combo) => {
      const key = JSON.stringify(combo);
      const old = oldVariantsMap.get(key);
      if (old) return old;

      return ensureVariantLocalKey({
        sku: buildVariantSku({
          spu: form.spu,
          optionsValues: combo,
          seed: `${Date.now()}-${Math.random()}`,
        }),
        barcode: '',
        supplier_sku: '',
        price: 0,
        cost_price: 0,
        stock_quantity: 0,
        alert_threshold: 10,
        options_values: combo,
        status: 'active',
        images: [],
      });
    });
  };

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
      const impact = await previewDimensionImpact(initialData.value.id, {
        action: 'archive_dimension',
        dimensionId: option.id,
      });
      dimensionArchiveWizard.open = true;
      dimensionArchiveWizard.optionIndex = idx;
      dimensionArchiveWizard.optionId = option.id;
      dimensionArchiveWizard.affectedVariantsCount = impact?.data?.affectedVariantsCount ?? 0;
      dimensionArchiveWizard.sampleVariants = Array.isArray(impact?.data?.sampleVariants)
        ? impact.data.sampleVariants
        : [];
      dimensionArchiveWizard.mode = 'archive_variants';
      dimensionArchiveWizard.step = 1;
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
      if (!opt.values.includes(v)) opt.values.push(v);
      if (extraMeta) opt.metaMap[v] = { ...opt.metaMap[v], ...extraMeta };

      if (editMode.value && opt.id && initialData.value?.id) {
        const payload = { value: v };
        if (opt.metaMap[v]) payload.meta = opt.metaMap[v];
        
        const response = await addDimensionValue(initialData.value.id, opt.id, payload);
        if (!response?.success) {
          addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
        }
      }
    }
    opt.inputValue = '';
    generateVariants();
  };

  const removeOptionValue = async (opt, vIdx) => {
    const value = opt.values[vIdx];
    if (editMode.value && opt.id && initialData.value?.id && value) {
      const valueMeta = (initialData.value?.dimensions || [])
        .find((dimension) => dimension.id === opt.id)
        ?.values?.find((entry) => entry.value === value);
      if (valueMeta?.id) {
        const impact = await previewDimensionImpact(initialData.value.id, {
          action: 'archive_value',
          valueId: valueMeta.id,
        });
        valueArchiveWizard.open = true;
        valueArchiveWizard.optionIndex = form.options.indexOf(opt);
        valueArchiveWizard.valueIndex = vIdx;
        valueArchiveWizard.valueId = valueMeta.id;
        valueArchiveWizard.valueLabel = value;
        valueArchiveWizard.affectedVariantsCount = impact?.data?.affectedVariantsCount ?? 0;
        valueArchiveWizard.sampleVariants = Array.isArray(impact?.data?.sampleVariants)
          ? impact.data.sampleVariants
          : [];
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
      const response = await restoreDimensionValue(initialData.value.id, valueId);
      if (!response?.success) {
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
        return;
      }
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
    dimensionArchiveWizard.loading = true;
    try {
      const response = await archiveDimension(initialData.value.id, dimensionArchiveWizard.optionId, {
        mode: dimensionArchiveWizard.mode,
      });
      if (!response?.success) {
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
        return;
      }
      if (dimensionArchiveWizard.optionIndex >= 0) {
        form.options.splice(dimensionArchiveWizard.optionIndex, 1);
        generateVariants();
      }
      closeDimensionArchiveWizard(true);
    } finally {
      dimensionArchiveWizard.loading = false;
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
    valueArchiveWizard.loading = true;
    try {
      const response = await archiveDimensionValue(initialData.value.id, valueArchiveWizard.valueId);
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
        }
        generateVariants();
      }
      closeValueArchiveWizard(true);
    } finally {
      valueArchiveWizard.loading = false;
    }
  };

  // ——— 变体辅助 ———
  const formatVariantSample = (sample) => {
    const raw = sample?.options_values || {};
    const optionsValues = typeof raw === 'string' ? parseJson(raw) || {} : raw;
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

  const variantOptionsKey = (optionsValues) =>
    JSON.stringify(
      Object.keys(optionsValues || {})
        .sort()
        .reduce((acc, key) => {
          acc[key] = optionsValues[key];
          return acc;
        }, {})
    );

  const handleBatchBuilderApply = ({ options = [], variants = [] }) => {
    const normalizedOptions = options.map((option) => ({
      name: option.name,
      values: Array.isArray(option.values) ? option.values : [],
      inputValue: '',
    }));
    form.options = normalizedOptions;

    const existingMap = new Map(
      form.variants.map((variant) => [variantOptionsKey(variant.options_values), variant])
    );

    for (const variant of variants) {
      const key = variantOptionsKey(variant.options_values);
      if (existingMap.has(key)) continue;
      const optionsValues = variant.options_values || {};
      form.variants.push({
        ...ensureVariantLocalKey(variant),
        sku: buildVariantSku({ spu: form.spu, optionsValues, seed: key }),
      });
      existingMap.set(key, variant);
    }
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
        variant.price === undefined ||
        variant.cost_price === undefined ||
        variant.stock_quantity === undefined ||
        variant.alert_threshold === undefined ||
        !variant.status
    );
    if (invalidVariant) {
      addToast({
        message: t('common.validation_error', '请完善每个变体的价格/成本/库存/预警/状态'),
        type: 'error',
      });
      return;
    }

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
        currency: normalizeCurrencyCode(form.currency),
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
          const { _clientKey, ...variantPayload } = variant;
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
        emit('success');
        emit('update:modelValue', false);
      }
    } finally {
      submitting.value = false;
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
    CURRENCY_OPTIONS,
    CURRENCY_SYMBOLS,
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
    variantOptionsKey,
    ensureVariantLocalKey,
  };
}
