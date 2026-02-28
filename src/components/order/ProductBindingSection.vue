<template>
  <div class="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/30 p-4">
    <h4 class="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-main)]">
      <AppIcon name="link" class="size-4 text-[var(--color-primary)]" />
      {{ t('order.binding.title') }}
    </h4>

    <!-- Bound Product Card -->
    <div v-if="boundProduct" class="flex items-center gap-3 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3">
      <div class="size-12 flex-shrink-0 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <AppImage 
          v-if="boundProduct.mainImage" 
          :src="boundProduct.mainImage" 
          fit="cover" 
          class="size-full" 
        />
        <div v-else class="flex h-full items-center justify-center text-[var(--text-muted)]">
          <AppIcon name="photo" class="size-6 stroke-[1.5]" />
        </div>
      </div>
      
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium text-[var(--text-main)]">{{ boundProduct.name }}</div>
        <div class="mt-0.5 text-xs text-[var(--text-secondary)]">{{ t('product.form.spu') }}: {{ displaySku }}</div>
        
        <!-- Variant Selector: 3D->2D->1D adaptive -->
        <div v-if="variants.length > 0" class="mt-2 space-y-1.5">
          <div v-for="dimension in dimensionKeys" :key="dimension" class="flex items-center gap-2">
            <span class="w-12 text-[10px] text-[var(--text-secondary)]">{{ getDimensionLabel(dimension) }}</span>
            <select
              :data-testid="getDimensionTestId(dimension)"
              v-model="selectedOptions[dimension]"
              @change="onDimensionChange(dimension)"
              class="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5 text-xs focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option
                v-for="option in getDimensionOptions(dimension)"
                :key="option.value"
                :value="option.value"
                :disabled="!option.selectable"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
          <div v-if="currentAvailabilityState" class="text-[10px] text-[var(--text-secondary)]">
            {{ availabilityTextMap[currentAvailabilityState] }}
          </div>
        </div>

        <div v-if="isLoadingDetails" class="mt-1 flex items-center gap-1 text-xs text-[var(--color-primary)] opacity-80">
          <AppIcon name="spinner" class="size-3 animate-spin" />
          Loading variants...
        </div>
      </div>

      <div class="flex items-center gap-1">
        <a 
          :href="`/admin/products?edit=${boundProduct.id}`"
          target="_blank"
          class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/10"
          :title="t('product.action.edit')"
        >
          <AppIcon name="pencil-square" class="size-4" />
          {{ t('product.action.edit') }}
        </a>
        <button 
          type="button" 
          class="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
          :title="t('order.binding.unbind')"
          @click="$emit('unbind')"
        >
          <AppIcon name="x-mark" class="size-5" />
        </button>
      </div>
    </div>

    <!-- Product Selector -->
    <div v-else>
      <p class="mb-2 text-xs text-[var(--text-secondary)]">{{ t('order.binding.hint') }}</p>
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
