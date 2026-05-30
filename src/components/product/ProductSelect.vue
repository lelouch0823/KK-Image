<template>
  <div ref="containerRef" class="relative w-full">
    <!-- Input Field -->
    <div class="relative">
      <AppInput
        v-model="searchQuery"
        class="bg-(--bg-muted)"
        :placeholder="placeholderText"
        @focus="open"
        @update:model-value="handleInput"
      >
        <template #prepend>
          <AppIcon name="magnifying-glass" class="size-5" />
        </template>
        <template v-if="loading" #append>
          <AppIcon name="spinner" class="text-primary size-4 animate-spin" />
        </template>
      </AppInput>
    </div>

    <!-- Dropdown -->
    <transition
      enter-active-class="transition duration-200 ease-out-expo"
      enter-from-class="translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-out-expo"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-if="isOpen && (items.length > 0 || loading || error || (searchQuery && items.length === 0))"
        class="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-(--border-subtle) bg-(--bg-card)/90 p-1.5 shadow-xl ring-1 ring-(--border-color)/40 backdrop-blur-xl"
      >
        <div v-if="error" class="rounded-lg border border-(--color-danger-text)/20 bg-(--color-danger-bg)/40 px-4 py-3">
          <p class="text-sm text-(--text-main)">{{ error }}</p>
          <AppButton
            variant="primary"
            size="sm"
            class="mt-2"
            data-testid="unified-product-retry"
            @click="retryLoad"
          >
            {{ t('common.retry') }}
          </AppButton>
        </div>
        
        <!-- Empty State -->
        <div v-if="!loading && !error && items.length === 0" class="px-4 py-8 text-center text-sm text-(--text-muted)">
          {{ t('common.noData') }}
        </div>

        <!-- List -->
        <ul v-else-if="!error" class="space-y-1">
          <li
            v-for="product in items"
            :key="product.id"
            class="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-(--bg-hover)"
            @click="select(product)"
          >
            <!-- Image -->
            <div class="relative size-10 shrink-0 overflow-hidden rounded-md border border-(--border-color) bg-(--bg-muted)">
               <AppImage
                  v-if="getMainImageSrc(product)"
                  :src="getMainImageSrc(product)"
                  :alt="product.name" 
                  fit="cover"
                  class="size-full"
               />
               <div v-else class="flex h-full items-center justify-center text-(--text-muted)">
                  <AppIcon name="photo" class="size-5" />
               </div>
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between">
                <span class="truncate font-medium text-(--text-main)">{{ product.name }}</span>
                <span v-if="!isSalesMode" class="ml-2 shrink-0 text-xs text-(--text-muted)">¥{{ product.price }}</span>
              </div>
              <div class="mt-0.5 flex items-center gap-2 text-xs text-(--text-secondary)">
                <span v-if="product.spu" class="rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono">{{ product.spu }}</span>
                <span class="truncate">{{ getProductSubtext(product) }}</span>
              </div>
            </div>
            
            <AppIcon v-if="isSalesMode" name="chevron-right" class="size-4 text-(--text-muted)" />
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useProducts } from '@/composables/useProducts';
import { useSalesProducts } from '@/composables/useSalesProducts';
import { onClickOutside, useDebounceFn } from '@vueuse/core';
import AppButton from '@/components/ui/AppButton.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import { resolvePrimaryProductImageSrc, resolveProductPreviewImageSrc } from '@/utils/product-image.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  statusFilter: { type: String, default: '' },
  mode: { type: String, default: 'admin' }, // 'admin' | 'sales'
  token: { type: String, default: '' },
  placeholder: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'select', 'load-error']);

const { t } = useI18n();

const isSalesMode = computed(() => props.mode === 'sales');

const { 
  products: adminProducts, 
  loadProducts: loadAdminProducts, 
  loading: adminLoading,
  error: adminError,
} = useProducts();

const { 
  products: salesProducts, 
  loadSalesProducts, 
  retryLoadSalesProducts,
  loading: salesLoading, 
  error: salesError 
} = useSalesProducts();

const containerRef = ref(null);
const isOpen = ref(false);
const searchQuery = ref('');
const lastLoadedContextKey = ref('');

const loading = computed(() => isSalesMode.value ? salesLoading.value : adminLoading.value);
const error = computed(() => isSalesMode.value ? salesError.value : adminError.value);
const items = computed(() => isSalesMode.value ? (salesProducts.value || []) : (adminProducts.value || []));
const currentContextKey = computed(() =>
  JSON.stringify({
    mode: props.mode,
    token: props.token,
    statusFilter: props.statusFilter,
  })
);

const placeholderText = computed(() => {
  if (props.placeholder) return props.placeholder;
  return isSalesMode.value 
    ? t('order.binding.salesSearchPlaceholder') 
    : (t('product.filters.search_placeholder') || 'Search products...');
});

const handleSearch = async (query) => {
  const contextKey = currentContextKey.value;
  if (isSalesMode.value) {
    if (!props.token) return;
    await loadSalesProducts(props.token, { search: query, page: 1, limit: 12 });
  } else {
    const params = { search: query, limit: 10, page: 1 };
    if (props.statusFilter) params.status = props.statusFilter;
    await loadAdminProducts(params);
  }
  lastLoadedContextKey.value = contextKey;
};

const open = () => {
  isOpen.value = true;
  if (!searchQuery.value && (items.value.length === 0 || lastLoadedContextKey.value !== currentContextKey.value)) {
      handleSearch('');
  }
};

const close = () => {
  isOpen.value = false;
};

onClickOutside(containerRef, close);

const debouncedSearch = useDebounceFn(handleSearch, 300);

const handleInput = () => {
    debouncedSearch(searchQuery.value);
};

const retryLoad = async () => {
  if (isSalesMode.value && props.token) {
    const result = await retryLoadSalesProducts(props.token);
    if (!result.ok) {
      emit('load-error', result.error || t('common.loadFailed'));
    }
    return;
  }
  await handleSearch(searchQuery.value);
};

const select = (product) => {
    emit('select', product);
    emit('update:modelValue', product.id);
    close();
    searchQuery.value = '';
};

const getMainImageSrc = (product) => {
  if (isSalesMode.value) {
    return resolveProductPreviewImageSrc(product);
  }
  return resolvePrimaryProductImageSrc(product);
};

const getProductSubtext = (product) => {
  if (isSalesMode.value) {
    return [product.brand, product.series].filter(Boolean).join(' · ') || '';
  }
  return product.category || '';
};

watch(error, (message) => {
  if (message) {
    emit('load-error', message);
  }
});

watch(currentContextKey, () => {
  lastLoadedContextKey.value = '';
  if (isOpen.value) {
    void handleSearch(searchQuery.value);
  }
});
</script>
