<template>
  <div class="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm">
    <div class="rounded-t-xl border-b border-[var(--border-subtle)] bg-[var(--bg-muted)]/40 px-6 py-4">
      <h4 class="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
        <AppIcon name="link" class="size-4 text-[var(--color-primary)]" />
        {{ t('order.binding.title') }}
      </h4>
    </div>

    <!-- Bound Product Card -->
    <div v-if="boundProduct" class="">
      <div class="flex items-start justify-between border-b border-[var(--border-subtle)] p-6">
        <div class="flex gap-4">
          <div class="size-20 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
            <AppImage 
              v-if="boundProduct.mainImage" 
              :src="boundProduct.mainImage" 
              fit="cover" 
              class="size-full object-cover" 
            />
            <div v-else class="flex h-full items-center justify-center text-[var(--text-muted)]">
              <AppIcon name="photo" class="size-8 stroke-[1.5]" />
            </div>
          </div>
          
          <div>
            <div class="mb-1.5 flex items-center gap-3">
              <h2 class="text-lg font-bold tracking-tight text-[var(--text-main)]">{{ boundProduct.name }}</h2>
              <span class="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs font-medium uppercase text-[var(--text-secondary)]">
                {{ displaySku || '—' }}
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

        <div class="flex gap-2">
          <a 
            :href="`/admin/products?edit=${boundProduct.id}`"
            target="_blank"
            class="cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
            :title="t('product.action.edit')"
          >
            <AppIcon name="pencil-square" class="size-5" />
          </a>
          <button 
            type="button" 
            class="cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
            :title="t('order.binding.unbind')"
            @click="$emit('unbind')"
          >
            <AppIcon name="trash" class="size-5" />
          </button>
        </div>
      </div>

      <!-- Configuration Body -->
      <div v-if="variants.length > 0" class="relative space-y-8 p-6">
        <div v-if="isLoadingDetails" class="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-card)]/50 backdrop-blur-sm">
           <AppIcon name="spinner" class="size-6 animate-spin text-[var(--color-primary)]" />
        </div>

        <section v-for="dimension in dimensionKeys" :key="dimension">
          <div class="mb-4 flex items-center justify-between">
            <label class="text-sm font-bold text-[var(--text-main)]">{{ getDimensionLabel(dimension) }}</label>
            <span class="text-[13px] text-[var(--text-secondary)]">
              已选择: {{ selectedOptions[dimension] || '未选择' }}
            </span>
          </div>

          <div v-if="isColorDimension(dimension)" class="flex flex-wrap gap-4">
            <label
              v-for="option in getDimensionOptions(dimension)"
              :key="option.value"
              class="group relative"
              :class="[option.selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50']"
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
                class="flex size-10 items-center justify-center rounded-full border-2 border-transparent shadow-sm transition-all peer-checked:border-[var(--bg-card)] peer-checked:ring-2 peer-checked:ring-[var(--text-main)]"
                :style="buildColorSwatchStyle(option.value)"
              >
                <AppIcon
                  v-if="selectedOptions[dimension] === option.value"
                  name="check"
                  class="size-5 text-white drop-shadow-md mix-blend-difference"
                />
              </div>
              <span class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-[var(--text-secondary)] opacity-0 transition-opacity group-hover:opacity-100">
                {{ option.label }}
              </span>
            </label>
          </div>

          <div v-else class="grid grid-cols-4 gap-3 sm:grid-cols-6">
            <label
              v-for="option in getDimensionOptions(dimension)"
              :key="option.value"
              class="relative"
              :class="[option.selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50']"
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
                class="rounded-lg border-2 border-[var(--border-subtle)] px-2 py-2.5 text-center text-sm font-semibold text-[var(--text-secondary)] transition-all peer-checked:border-[var(--text-main)] peer-checked:text-[var(--text-main)]"
                :class="{ 'border-dashed border-[var(--border-subtle)]/50': !option.selectable }"
              >
                {{ option.label }}
              </div>
            </label>
          </div>
        </section>

        <!-- Inventory Info Footer -->
        <div class="flex flex-col justify-between gap-4 rounded-xl bg-[var(--bg-muted)]/50 p-4 sm:flex-row sm:items-center">
          <div class="flex gap-6">
            <div>
              <p class="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">库存状态</p>
              <p class="text-sm font-semibold text-[var(--text-main)]">{{ selectedStockQuantity }} 件在库</p>
            </div>
            <div>
              <p class="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">补货中</p>
              <p class="text-sm font-semibold text-[var(--text-main)]">
                {{ selectedReplenishmentQuantity }} 件
                <span v-if="selectedReplenishmentPoCount > 0" class="ml-1 text-xs font-normal text-[var(--text-secondary)]">({{ selectedReplenishmentPoCount }} 单)</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Selector -->
    <div v-else class="p-6">
      <p class="mb-3 text-sm font-medium text-[var(--text-secondary)]">{{ t('order.binding.hint') }}</p>
      <ProductSelect status-filter="active" @select="handleProductSelect" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import ProductSelect from '@/components/product/ProductSelect.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useProducts } from '@/composables/useProducts';
import {
  getVariantAvailabilityState,
  isVariantSelectable,
} from '@/utils/variant-meta';

const props = defineProps({
  boundProduct: { type: Object, default: null },
});

const emit = defineEmits(['select', 'unbind']);

const { t } = useI18n();
const { loadProduct } = useProducts();

const isLoadingDetails = ref(false);
const variants = ref([]);
const selectedVariantId = ref(null);
const fullProductData = ref(null);
const selectedOptions = reactive({});
const availabilityTextMap = {
  available: '可下单',
  low_stock: '低库存',
  disabled_out_of_stock: '缺货（不可下单）',
  disabled_archived: '已停用（不可下单）',
};
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

const getDimensionTestId = (dimensionKey) => `dimension-${String(dimensionKey || '').replace(/\s+/g, '_')}`;

const displaySku = computed(() => {
  if (variants.value.length > 0 && selectedVariantId.value) {
    const v = variants.value.find(x => x.id === selectedVariantId.value);
    if (v && v.sku) return v.sku;
  }
  return props.boundProduct?.sku || '';
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
      selectable: isVariantSelectable(variant),
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
  if (currentAvailabilityState.value === 'available') return 'bg-[var(--color-success-bg)] text-[var(--color-success)]';
  if (currentAvailabilityState.value === 'low_stock') return 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]';
  if (currentAvailabilityState.value === 'disabled_out_of_stock') return 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]';
  return 'bg-[var(--bg-muted)] text-[var(--text-secondary)]';
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

const resolveVariantImageId = (variant) => {
    if (!variant) return null;
    if (variant.primaryImage) return variant.primaryImage;
    if (variant.image_id) return variant.image_id;
    if (Array.isArray(variant.images) && variant.images.length > 0) {
        const primary = variant.images.find((img) => Number(img.is_primary) === 1) || variant.images[0];
        return primary?.image_id || null;
    }
    return null;
};

const resolveProductImageId = (product) => {
    try {
        if (!product?.images) return null;
        const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
        return Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
    } catch {
        return null;
    }
};

const buildMainImagePath = (product, variant) => {
  const imageId = resolveVariantImageId(variant) || resolveProductImageId(product);
  return imageId ? `/file/${imageId}` : null;
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
    mainImage: buildMainImagePath(fullProductData.value, rawVariant),
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
    const fullProduct = await loadProduct(product.id || product.productId);
    fullProductData.value = fullProduct;
    if (fullProduct && fullProduct.variants && fullProduct.variants.length > 0) {
      variants.value = fullProduct.variants;
      initSelectionFromVariants();
    } else {
      variants.value = [];
      selectedVariantId.value = null;
    }
  } catch {
    variants.value = [];
    selectedVariantId.value = null;
  } finally {
    isLoadingDetails.value = false;
  }
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
