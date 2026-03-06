<template>
  <div class="rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-sm">
    <div class="rounded-t-xl border-b border-(--border-subtle) bg-(--bg-muted)/40 px-4 py-3 sm:px-6 sm:py-4">
      <h4 class="flex items-center gap-2 text-sm font-semibold text-(--text-main)">
        <AppIcon name="link" class="text-primary size-4" />
        {{ isSalesMode ? t('order.binding.salesTitle') : t('order.binding.title') }}
      </h4>
    </div>

    <!-- Bound Product Card -->
    <div v-if="boundProduct" class="">
      <div class="flex flex-col gap-4 border-b border-(--border-subtle) p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div class="flex gap-3 sm:gap-4">
          <div class="size-16 flex-shrink-0 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-muted) sm:size-20">
            <AppImage 
              v-if="boundProduct.mainImage" 
              :src="boundProduct.mainImage" 
              fit="cover" 
              class="size-full cursor-pointer object-cover transition-transform hover:scale-105" 
              @click="openLightbox"
            />
            <div v-else class="flex h-full items-center justify-center text-(--text-muted)">
              <AppIcon name="photo" class="size-8 stroke-[1.5]" />
            </div>
          </div>
          
          <div>
            <div class="mb-1.5 flex flex-wrap items-center gap-2 sm:gap-3">
              <h2
                class="max-w-full min-w-0 flex-1 truncate text-base font-bold tracking-tight text-(--text-main) sm:text-lg"
                :title="boundProduct.name || ''"
              >
                {{ displayProductName }}
              </h2>
              <span
                class="max-w-[12rem] truncate rounded-md border border-(--border-subtle) bg-(--bg-muted) px-2 py-0.5 font-mono text-xs font-medium text-(--text-secondary) uppercase sm:max-w-[16rem]"
                :title="displaySku || ''"
              >
                {{ displaySku || '—' }}
              </span>
              <span
                v-if="isSalesMode"
                class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium"
              >
                {{ t('order.binding.bound') }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span
                v-if="currentAvailabilityState"
                class="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="availabilityBadgeClass"
              >
                <AppIcon v-if="currentAvailabilityState === 'available'" name="check-circle" class="size-3.5" />
                {{ availabilityTextMap[currentAvailabilityState] }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex gap-2 self-end sm:self-auto">
          <a 
            v-if="isAdminMode"
            :href="`/admin/products?edit=${boundProduct.id}`"
            target="_blank"
            class="hover:bg-primary/10 hover:text-primary cursor-pointer rounded-lg p-2 text-(--text-muted) transition-colors"
            :title="t('product.action.edit')"
          >
            <AppIcon name="pencil-square" class="size-5" />
          </a>
          <button 
            type="button" 
            class="cursor-pointer rounded-lg p-2 text-(--text-muted) transition-colors hover:bg-(--color-danger-bg) hover:text-(--color-danger-text)"
            :title="t('order.binding.unbind')"
            @click="$emit('unbind')"
          >
            <AppIcon name="trash" class="size-5" />
          </button>
        </div>
      </div>

      <!-- Configuration Body -->
      <div v-if="variants.length > 0" class="relative space-y-5 p-4 sm:space-y-7 sm:p-6">
        <div v-if="isLoadingDetails" class="absolute inset-0 z-10 flex items-center justify-center bg-(--bg-card)/50 backdrop-blur-sm">
           <AppIcon name="spinner" class="text-primary size-6 animate-spin" />
        </div>

        <section v-for="dimension in dimensionKeys" :key="dimension">
          <div class="mb-3 flex items-center justify-between">
            <label
              class="max-w-[52%] truncate pr-3 text-sm font-bold text-(--text-main)"
              :title="getDimensionLabel(dimension)"
            >
              {{ getDimensionLabelDisplay(dimension) }}
            </label>
            <span
              class="max-w-[48%] truncate text-right text-xs text-(--text-secondary) sm:text-[13px]"
              :title="selectedOptions[dimension] || ''"
            >
              {{ t('order.binding.selectedLabel') }}: {{ getSelectedOptionDisplay(dimension) || t('order.binding.unselected') }}
            </span>
          </div>

          <div v-if="isColorDimension(dimension)" class="flex flex-wrap gap-x-4 gap-y-3 sm:gap-5">
            <label
              v-for="option in getDimensionOptions(dimension)"
              :key="option.value"
              class="group flex flex-col items-center gap-1.5 focus-within:outline-none"
              :class="[option.selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50']"
              :data-testid="getDimensionTestId(dimension)"
            >
              <input
                type="radio"
                class="peer sr-only"
                :name="`dimension-${dimension}`"
                :value="option.value"
                :disabled="!option.selectable"
                :checked="selectedOptions[dimension] === option.value"
                @change="selectDimensionOption(dimension, option.value)"
              />
              <div
                class="peer-focus-visible:ring-primary/50 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 flex size-9 items-center justify-center rounded-full border-2 border-transparent shadow-sm transition-all peer-checked:border-(--bg-card) peer-checked:ring-2 peer-checked:ring-(--text-main) sm:size-10"
                :style="buildColorSwatchStyle(option.value)"
              >
                <AppIcon
                  v-if="selectedOptions[dimension] === option.value"
                  name="check"
                  class="size-4 text-white mix-blend-difference drop-shadow-md sm:size-5"
                />
              </div>
              <span class="max-w-16 truncate text-center text-[11px] font-medium text-(--text-secondary) transition-colors peer-checked:font-bold peer-checked:text-(--text-main)" :title="option.label">
                {{ getOptionLabelDisplay(option.label) }}
              </span>
            </label>
          </div>

          <div v-else class="grid [grid-template-columns:repeat(auto-fit,minmax(6.75rem,1fr))] gap-2.5 sm:[grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr))]">
            <label
              v-for="option in getDimensionOptions(dimension)"
              :key="option.value"
              class="focus-within:ring-primary/50 focus-within:ring-2 focus-within:ring-offset-1 relative min-w-0 rounded-lg focus-within:outline-none"
              :class="[option.selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50']"
              :data-testid="getDimensionTestId(dimension)"
            >
              <input
                type="radio"
                class="peer sr-only"
                :name="`dimension-${dimension}`"
                :value="option.value"
                :disabled="!option.selectable"
                :checked="selectedOptions[dimension] === option.value"
                @change="selectDimensionOption(dimension, option.value)"
              />
              <div
                class="flex min-h-11 items-center justify-center rounded-lg border-2 border-(--border-subtle) px-2 py-1.5 text-center text-[13px] font-semibold text-(--text-secondary) transition-all peer-checked:border-(--text-main) peer-checked:text-(--text-main) sm:min-h-11 sm:text-sm"
                :class="{ 'border-dashed border-(--border-subtle)/50': !option.selectable }"
              >
                <span class="line-clamp-2 break-words" :title="option.label">
                  {{ getOptionLabelDisplay(option.label) }}
                </span>
              </div>
            </label>
          </div>
        </section>

        <!-- Inventory Info Footer -->
        <div class="flex flex-col justify-between gap-4 rounded-xl bg-(--bg-muted)/50 p-4 sm:flex-row sm:items-center">
          <div class="flex gap-6">
            <div>
              <p class="mb-1 text-[10px] font-bold tracking-widest text-(--text-secondary) uppercase">{{ t('order.binding.stockLabel') }}</p>
              <p class="text-sm font-semibold text-(--text-main)">{{ selectedStockQuantity }} {{ t('order.binding.stockUnit') }}</p>
            </div>
            <div>
              <p class="mb-1 text-[10px] font-bold tracking-widest text-(--text-secondary) uppercase">{{ t('order.binding.replenishmentLabel') }}</p>
              <p class="text-sm font-semibold text-(--text-main)">
                {{ selectedReplenishmentQuantity }} {{ t('order.binding.stockUnit') }}
                <span v-if="selectedReplenishmentPoCount > 0" class="ml-1 text-xs font-normal text-(--text-secondary)">({{ selectedReplenishmentPoCount }} {{ t('order.binding.poUnit') }})</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Selector -->
    <div v-else class="p-4 sm:p-6">
      <p class="mb-3 text-sm font-medium text-(--text-secondary)">
        {{ isSalesMode ? t('order.binding.salesHint') : t('order.binding.hint') }}
      </p>
      <SalesProductSelect
        v-if="isSalesMode"
        :token="salesToken"
        @select="handleProductSelect"
        @load-error="handleProductFetchError"
      />
      <ProductSelect
        v-else
        status-filter="active"
        @select="handleProductSelect"
      />
    </div>

    <!-- Image Lightbox -->
    <Lightbox
      :visible="isLightboxVisible"
      :current-file="lightboxFile"
      :current-index="0"
      :total="1"
      @close="isLightboxVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import ProductSelect from '@/components/product/ProductSelect.vue';
import SalesProductSelect from '@/components/order/SalesProductSelect.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Lightbox from '@/components/ui/Lightbox.vue';
import { useProducts } from '@/composables/useProducts';
import { useSalesProducts } from '@/composables/useSalesProducts';
import {
  getVariantAvailabilityState,
} from '@/utils/variant-meta';
import {
  resolveVariantPrimaryImageSrc,
} from '@/utils/product-image.js';

const props = defineProps({
  boundProduct: { type: Object, default: null },
  mode: { type: String, default: 'admin' }, // 'admin' | 'sales'
  salesToken: { type: String, default: '' },
  variantSelectPolicy: {
    type: String,
    default: 'allow_out_of_stock',
    validator: (value) => ['allow_out_of_stock', 'in_stock_only', 'all'].includes(String(value || '')),
  },
});

const emit = defineEmits(['select', 'unbind', 'product-fetch-error', 'product-fetch-success']);

const { t } = useI18n();
const { loadProduct } = useProducts();
const { loadSalesProduct } = useSalesProducts();

const isSalesMode = computed(() => props.mode === 'sales');
const isAdminMode = computed(() => !isSalesMode.value);

const isLightboxVisible = ref(false);
const lightboxFile = ref(null);

const openLightbox = () => {
  if (!props.boundProduct?.mainImage) return;
  lightboxFile.value = {
    url: props.boundProduct.mainImage,
    name: props.boundProduct.name || 'Image Preview'
  };
  isLightboxVisible.value = true;
};

const isLoadingDetails = ref(false);
const variants = ref([]);
const selectedVariantId = ref(null);
const fullProductData = ref(null);
const selectedOptions = reactive({});
const normalizedVariantSelectPolicy = computed(() => String(props.variantSelectPolicy || 'allow_out_of_stock'));
const TEXT_LIMITS = Object.freeze({
  productName: 48,
  sku: 32,
  dimensionLabel: 18,
  selectedValue: 22,
  optionLabel: 24,
});
const availabilityTextMap = computed(() => ({
  available: '可下单',
  low_stock: '低库存',
  disabled_out_of_stock: normalizedVariantSelectPolicy.value === 'in_stock_only'
    ? '缺货（不可下单）'
    : '缺货（可预订）',
  disabled_archived: normalizedVariantSelectPolicy.value === 'all'
    ? '已停用（可选）'
    : '已停用（不可下单）',
}));
const COLOR_LABELS = ['color', '颜色', '顏色'];
const COLOR_VALUE_MAP = {
  white: '#ffffff',
  black: '#111827',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  gray: '#9ca3af',
  grey: '#9ca3af',
  purple: '#8b5cf6',
  pink: '#ec4899',
  orange: '#f97316',
  // Chinese mapping
  '白': '#ffffff', '白色': '#ffffff',
  '黑': '#111827', '黑色': '#111827',
  '红': '#ef4444', '红色': '#ef4444',
  '蓝': '#3b82f6', '蓝色': '#3b82f6',
  '绿': '#10b981', '绿色': '#10b981',
  '黄': '#f59e0b', '黄色': '#f59e0b',
  '灰': '#9ca3af', '灰色': '#9ca3af',
  '深灰': '#4b5563', '浅灰': '#d1d5db',
  '银色': '#e5e7eb', '银': '#e5e7eb',
  '紫': '#8b5cf6', '紫色': '#8b5cf6',
  '粉': '#ec4899', '粉色': '#ec4899',
  '橙': '#f97316', '橙色': '#f97316',
};

const parseOptionsValues = (value) => {
  if (!value || typeof value !== 'object') return {};
  const result = {};
  for (const [rawKey, rawVal] of Object.entries(value)) {
    const key = String(rawKey || '').trim();
    const val = String(rawVal || '').trim();
    if (!key || !val) continue;
    result[key] = val;
  }
  return result;
};

const getDimensionLabel = (dimensionKey) => {
  const map = fullProductData.value?.dimension_map || {};
  return map[dimensionKey] || String(dimensionKey || '');
};

const clampText = (value, maxLength) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
};

const getDimensionLabelDisplay = (dimensionKey) => clampText(getDimensionLabel(dimensionKey), TEXT_LIMITS.dimensionLabel);
const getSelectedOptionDisplay = (dimensionKey) => clampText(selectedOptions[dimensionKey] || '', TEXT_LIMITS.selectedValue);
const getOptionLabelDisplay = (value) => clampText(value, TEXT_LIMITS.optionLabel);
const displayProductName = computed(() => clampText(props.boundProduct?.name || '', TEXT_LIMITS.productName));

const getDimensionTestId = (dimensionKey) => `dimension-${String(dimensionKey || '').replace(/\s+/g, '_')}`;

const displaySku = computed(() => {
  if (variants.value.length > 0 && selectedVariantId.value) {
    const v = variants.value.find(x => x.id === selectedVariantId.value);
    if (v && v.sku) return clampText(v.sku, TEXT_LIMITS.sku);
  }
  return clampText(props.boundProduct?.sku || '', TEXT_LIMITS.sku);
});

const normalizedVariants = computed(() => {
  return variants.value.map((variant) => {
    let rawOptions = variant.options_values || {};
    if (typeof rawOptions === 'string') {
      try {
        rawOptions = JSON.parse(rawOptions);
      } catch {
        rawOptions = {};
      }
    }
    const optionsMap = parseOptionsValues(rawOptions);
    const availabilityState = getVariantAvailabilityState(variant);
    return {
      ...variant,
      optionsMap,
      displayName: Object.values(optionsMap).join(' / ') || '-',
      availabilityState,
      selectable: isVariantSelectableByMode(variant),
    };
  });
});

const dimensionKeys = computed(() => {
  const keysFromVariants = [];
  for (const variant of normalizedVariants.value) {
    for (const key of Object.keys(variant.optionsMap || {})) {
      if (!keysFromVariants.includes(key)) keysFromVariants.push(key);
    }
  }

  const dimensions = Array.isArray(fullProductData.value?.dimensions) ? fullProductData.value.dimensions : [];
  const orderedByDimensions = dimensions
    .map((dimension) => String(dimension?.id || '').trim())
    .filter((id) => id && keysFromVariants.includes(id));

  const remainder = keysFromVariants.filter((key) => !orderedByDimensions.includes(key));
  return [...orderedByDimensions, ...remainder];
});

const currentSelectedVariant = computed(() => {
  if (!selectedVariantId.value) return null;
  return normalizedVariants.value.find((v) => v.id === selectedVariantId.value) || null;
});

const currentAvailabilityState = computed(() => currentSelectedVariant.value?.availabilityState || '');
const selectedStockQuantity = computed(() => Number(currentSelectedVariant.value?.stock_quantity || 0));
const selectedReplenishmentQuantity = computed(() => Number(currentSelectedVariant.value?.replenishment_quantity || 0));
const selectedReplenishmentPoCount = computed(() => Number(currentSelectedVariant.value?.replenishment_po_count || 0));
const availabilityBadgeClass = computed(() => {
  if (currentAvailabilityState.value === 'available') return 'bg-(--color-success-bg) text-success';
  if (currentAvailabilityState.value === 'low_stock') return 'bg-(--color-warning-bg) text-warning';
  if (currentAvailabilityState.value === 'disabled_out_of_stock') return 'bg-(--color-danger-bg) text-(--color-danger-text)';
  return 'bg-(--bg-muted) text-(--text-secondary)';
});

const isColorDimension = (dimensionKey) => {
  const label = getDimensionLabel(dimensionKey).toLowerCase();
  const key = String(dimensionKey || '').toLowerCase();
  return COLOR_LABELS.includes(label) || COLOR_LABELS.includes(key);
};

const buildColorSwatchStyle = (rawValue) => {
  const value = String(rawValue || '').trim().toLowerCase();
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  const color = isHex ? value : (COLOR_VALUE_MAP[value] || '#94a3b8');
  return { backgroundColor: color };
};

const buildMainImagePath = (variant) => resolveVariantPrimaryImageSrc(variant);

const normalizeVariantStatus = (variant) => String(variant?.status ?? '').trim().toLowerCase();
const getVariantStockQuantity = (variant) => Number(variant?.stock_quantity ?? variant?.stockQuantity ?? 0);

const isVariantSelectableByMode = (variant) => {
  const policy = normalizedVariantSelectPolicy.value;
  if (policy === 'all') return true;

  const isArchived = normalizeVariantStatus(variant) === 'archived';
  if (isArchived) return false;

  if (policy === 'in_stock_only') {
    return getVariantStockQuantity(variant) > 0;
  }

  // Default for preorder/admin: allow active variants even when out of stock.
  return true;
};

const matchBySelectedOptions = (variant) => {
  return dimensionKeys.value.every((dimension) => {
    const selected = selectedOptions[dimension];
    return !selected || variant.optionsMap[dimension] === selected;
  });
};

const emitVariantSelection = (variant) => {
  if (!variant || !variant.selectable) return;
  selectedVariantId.value = variant.id;
  for (const dimension of dimensionKeys.value) {
    selectedOptions[dimension] = variant.optionsMap[dimension] || '';
  }
  const rawVariant = variants.value.find((v) => v.id === variant.id) || variant;
  emit('select', {
    ...fullProductData.value,
    selectedVariant: rawVariant,
    mainImage: buildMainImagePath(rawVariant),
  });
};

const syncSelection = () => {
  const candidates = normalizedVariants.value.filter(matchBySelectedOptions);
  const picked = candidates.find((v) => v.selectable) || null;
  if (!picked) {
    selectedVariantId.value = null;
    return;
  }
  emitVariantSelection(picked);
};

const getDimensionOptions = (dimension) => {
  const dimIndex = dimensionKeys.value.indexOf(dimension);
  const prefixDimensions = dimensionKeys.value.filter((_, idx) => idx < dimIndex);
  const scoped = normalizedVariants.value.filter((variant) =>
    prefixDimensions.every((d) => !selectedOptions[d] || variant.optionsMap[d] === selectedOptions[d])
  );
  const values = [...new Set(scoped.map((v) => v.optionsMap[dimension]).filter(Boolean))];
  return values.map((value) => ({
    value,
    label: value,
    selectable: scoped.some((variant) => variant.optionsMap[dimension] === value && variant.selectable),
  }));
};

const onDimensionChange = (changedDimension) => {
  const changedIndex = dimensionKeys.value.indexOf(changedDimension);
  if (changedIndex >= 0) {
    for (let i = changedIndex + 1; i < dimensionKeys.value.length; i++) {
      selectedOptions[dimensionKeys.value[i]] = '';
    }
  }
  syncSelection();
};

const selectDimensionOption = (dimension, value) => {
  selectedOptions[dimension] = value;
  onDimensionChange(dimension);
};

const initSelectionFromVariants = () => {
  const firstSelectable = normalizedVariants.value.find((variant) => variant.selectable);
  if (!firstSelectable) {
    selectedVariantId.value = null;
    for (const dimension of Object.keys(selectedOptions)) selectedOptions[dimension] = '';
    return;
  }
  emitVariantSelection(firstSelectable);
};

const handleProductSelect = async (product) => {
  isLoadingDetails.value = true;
  variants.value = [];
  selectedVariantId.value = null;
  fullProductData.value = null;

  try {
    const productId = product.id || product.productId;
    const fullProduct = isSalesMode.value
      ? await loadSalesProduct(props.salesToken, productId)
      : await loadProduct(productId);
    fullProductData.value = fullProduct;
    if (fullProduct && fullProduct.variants && fullProduct.variants.length > 0) {
      variants.value = fullProduct.variants;
      initSelectionFromVariants();
      emit('product-fetch-success');
    } else {
      variants.value = [];
      selectedVariantId.value = null;
      emit('product-fetch-error', t('order.binding.variantRequired'));
    }
  } catch {
    variants.value = [];
    selectedVariantId.value = null;
    emit('product-fetch-error', t('common.loadFailed'));
  } finally {
    isLoadingDetails.value = false;
  }
};

const handleProductFetchError = (message) => {
  emit('product-fetch-error', message || t('common.loadFailed'));
};

watch(() => props.boundProduct, (newVal) => {
    if (!newVal) {
        variants.value = [];
        selectedVariantId.value = null;
        fullProductData.value = null;
        for (const dimension of Object.keys(selectedOptions)) selectedOptions[dimension] = '';
    }
});
</script>
