<template>
  <div ref="containerRef" class="relative w-full">
    <div class="relative">
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-(--text-muted)">
        <AppIcon name="magnifying-glass" class="size-5" />
      </div>
      <input
        v-model="searchQuery"
        type="text"
        class="h-12 w-full rounded-xl border border-(--border-color) bg-(--bg-muted) py-2.5 pr-4 pl-10 text-sm text-(--text-main) transition-colors placeholder:text-(--text-muted) focus:border-primary focus:bg-(--bg-card) focus:ring-2 focus:ring-primary/20 focus:outline-none"
        :placeholder="placeholderText"
        @focus="open"
        @input="handleInput"
      />
      <div v-if="loading" class="absolute inset-y-0 right-0 flex items-center pr-3">
        <AppIcon name="spinner" class="size-4 animate-spin text-primary" />
      </div>
    </div>

    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-if="isOpen && (items.length > 0 || loading || error || (searchQuery && items.length === 0))"
        class="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-(--border-subtle) bg-(--bg-card) p-1.5 shadow-xl"
      >
        <div v-if="error" class="rounded-lg border border-[var(--color-danger-text)]/20 bg-[var(--color-danger-bg)]/40 px-4 py-3">
          <p class="text-sm text-[var(--text-main)]">{{ error }}</p>
          <button
            type="button"
            class="mt-2 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-inverse)]"
            data-testid="sales-product-retry"
            @click="retryLoad"
          >
            {{ t('common.retry') }}
          </button>
        </div>
        <div v-if="!loading && items.length === 0" class="px-4 py-8 text-center text-sm text-(--text-muted)">
          {{ t('common.noData') }}
        </div>
        <ul v-else class="space-y-1">
          <li
            v-for="product in items"
            :key="product.id"
            class="cursor-pointer rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-(--border-subtle) hover:bg-(--bg-hover)"
            @click="select(product)"
          >
            <div class="flex items-center gap-3">
              <div class="relative size-11 shrink-0 overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-muted)">
                <AppImage
                  v-if="product.primaryImage"
                  :src="`/file/${product.primaryImage}`"
                  fit="cover"
                  class="size-full"
                />
                <div v-else class="flex h-full items-center justify-center text-(--text-muted)">
                  <AppIcon name="photo" class="size-5" />
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-(--text-main)">{{ product.name }}</p>
                <p class="mt-0.5 truncate text-xs text-(--text-secondary)">
                  {{ [product.brand, product.series, product.spu].filter(Boolean).join(' · ') || '-' }}
                </p>
              </div>
              <AppIcon name="chevron-right" class="size-4 text-(--text-muted)" />
            </div>
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { onClickOutside, useDebounceFn } from '@vueuse/core';
import { useI18n } from '@/composables/useI18n';
import { useSalesProducts } from '@/composables/useSalesProducts';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppImage from '@/components/ui/AppImage.vue';

const props = defineProps({
  token: { type: String, required: true },
  placeholder: { type: String, default: '' },
});

const emit = defineEmits(['select', 'load-error']);

const { t } = useI18n();
const { products, loading, error, loadSalesProducts, retryLoadSalesProducts } = useSalesProducts();

const containerRef = ref(null);
const searchQuery = ref('');
const isOpen = ref(false);

const items = computed(() => products.value || []);
const placeholderText = computed(
  () => props.placeholder || t('order.binding.salesSearchPlaceholder')
);

const runSearch = async (query) => {
  await loadSalesProducts(props.token, { search: query, page: 1, limit: 12 });
};

const debouncedSearch = useDebounceFn(runSearch, 250);

const open = async () => {
  isOpen.value = true;
  if (items.value.length === 0) {
    await runSearch(searchQuery.value);
  }
};

const close = () => {
  isOpen.value = false;
};

const handleInput = () => {
  debouncedSearch(searchQuery.value);
};

const retryLoad = async () => {
  const result = await retryLoadSalesProducts(props.token);
  if (!result.ok) {
    emit('load-error', result.error || t('common.loadFailed'));
  }
};

const select = (product) => {
  emit('select', product);
  close();
  searchQuery.value = '';
};

onClickOutside(containerRef, close);

watch(error, (message) => {
  if (message) {
    emit('load-error', message);
  }
});
</script>

