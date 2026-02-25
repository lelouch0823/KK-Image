<template>
  <div class="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/30 p-4">
    <h4 class="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-main)]">
      <svg class="size-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
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
          <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium text-[var(--text-main)]">{{ boundProduct.name }}</div>
        <div class="mt-0.5 text-xs text-[var(--text-secondary)]">{{ t('product.form.spu') }}: {{ displaySku }}</div>
        <!-- Variant Selector -->
        <div v-if="variants.length > 0" class="mt-2">
           <select v-model="selectedVariantId" @change="onVariantChange" class="w-full text-xs rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none">
              <option v-for="v in variants" :key="v.id" :value="v.id">
                  {{ formatVariantName(v.options_values) }} - ¥{{ v.price }} ({{ t('product.stats.stock_level') }}: {{ v.stock_quantity }})
              </option>
           </select>
        </div>
        <div v-if="isLoadingDetails" class="mt-1 text-xs text-[var(--color-primary)] opacity-80 flex items-center gap-1">
            <svg class="size-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
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
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          {{ t('product.action.edit') }}
        </a>
        <button 
          type="button" 
          class="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
          :title="t('order.binding.unbind')"
          @click="$emit('unbind')"
        >
          <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Product Selector -->
    <div v-else>
      <p class="mb-2 text-xs text-[var(--text-secondary)]">{{ t('order.binding.hint') }}</p>
      <ProductSelect @select="handleProductSelect" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import ProductSelect from '@/components/product/ProductSelect.vue';
import AppImage from '@/components/ui/AppImage.vue';
import { useProducts } from '@/composables/useProducts';

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

const displaySku = computed(() => {
    if (variants.value.length > 0 && selectedVariantId.value) {
        const v = variants.value.find(x => x.id === selectedVariantId.value);
        if (v && v.sku) return v.sku;
    }
    return props.boundProduct?.sku || '';
});

const formatVariantName = (optionsValues) => {
    try {
        const parsed = typeof optionsValues === 'string' ? JSON.parse(optionsValues) : optionsValues;
        if (!parsed || Object.keys(parsed).length === 0) return 'Default Variant';
        return Object.values(parsed).join(' / ');
    } catch { return 'Default Variant'; }
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
            selectedVariantId.value = fullProduct.variants[0].id;
            emit('select', {
                ...fullProduct,
                selectedVariant: fullProduct.variants[0],
                mainImage: buildMainImagePath(fullProduct, fullProduct.variants[0]),
            });
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

const onVariantChange = () => {
    const v = variants.value.find(x => x.id === selectedVariantId.value);
    emit('select', {
        ...fullProductData.value,
        selectedVariant: v,
        mainImage: buildMainImagePath(fullProductData.value, v),
    });
};

watch(() => props.boundProduct, (newVal) => {
    if (!newVal) {
        variants.value = [];
        selectedVariantId.value = null;
        fullProductData.value = null;
    }
});
</script>
