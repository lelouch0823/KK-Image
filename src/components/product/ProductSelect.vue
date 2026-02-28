<template>
  <div ref="containerRef" class="relative w-full">
    <!-- Input Field -->
    <div class="relative">
      <div 
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-(--text-muted)"
      >
        <AppIcon name="magnifying-glass" class="size-5" />
      </div>
      <input
        v-model="searchQuery"
        type="text"
        class="focus:border-primary focus:ring-primary focus:bg-(--bg-card) focus:ring-1 focus:outline-none w-full rounded-lg border-(--border-color) bg-(--bg-muted) py-2.5 pr-4 pl-10 text-sm text-(--text-main) transition-colors placeholder:text-(--text-muted)"
        :placeholder="t('product.filters.search_placeholder') || 'Search products...'"
        @focus="open"
        @input="handleInput"
      />
      
      <!-- Loading Indicator -->
      <div v-if="loading" class="absolute inset-y-0 right-0 flex items-center pr-3">
        <AppIcon name="spinner" class="text-primary size-4 animate-spin" />
      </div>
    </div>

    <!-- Dropdown -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-if="isOpen && (products.length > 0 || loading || (searchQuery && products.length === 0))"
        class="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-(--border-subtle) bg-(--bg-card)/90 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur-xl"
      >
        <!-- Empty State -->
        <div v-if="!loading && products.length === 0" class="px-4 py-8 text-center text-sm text-(--text-muted)">
          {{ t('common.noData') }}
        </div>

        <!-- List -->
        <ul v-else class="space-y-1">
          <li
            v-for="product in products"
            :key="product.id"
            class="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-(--bg-hover)"
            @click="select(product)"
          >
            <!-- Image -->
            <div class="relative size-10 shrink-0 overflow-hidden rounded-md border border-(--border-color) bg-(--bg-muted)">
               <AppImage 
                  v-if="getMainImage(product)" 
                  :src="getFileUrl(getMainImage(product))" 
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
                <span class="ml-2 shrink-0 text-xs text-(--text-muted)">¥{{ product.price }}</span>
              </div>
              <div class="mt-0.5 flex items-center gap-2 text-xs text-(--text-secondary)">
                <span class="rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono">{{ product.spu }}</span>
                <span v-if="product.category" class="truncate">{{ product.category }}</span>
              </div>
            </div>
            
            <!-- Checkmark (if selected? optional) -->
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useProducts } from '@/composables/useProducts';
import { onClickOutside, useDebounceFn } from '@vueuse/core';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  modelValue: { type: String, default: '' }, // existing code compatibility
  statusFilter: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'select']);

const { t } = useI18n();
const { products, loadProducts, loading } = useProducts();

const containerRef = ref(null);
const isOpen = ref(false);
const searchQuery = ref('');

const open = () => {
  isOpen.value = true;
  if (!searchQuery.value && products.value.length === 0) {
      handleSearch('');
  }
};

const close = () => {
  isOpen.value = false;
};

onClickOutside(containerRef, close);

const handleSearch = async (query) => {
    const params = { search: query, limit: 10, page: 1 };
    if (props.statusFilter) params.status = props.statusFilter;
    await loadProducts(params);
};

const debouncedSearch = useDebounceFn(handleSearch, 300);

const handleInput = () => {
    debouncedSearch(searchQuery.value);
};

const select = (product) => {
    emit('select', product);
    emit('update:modelValue', product.id);
    close();
    // Reset search? Or Keep it? 
    // Usually keep it, but parent might replace this component with a card.
    searchQuery.value = ''; // Reset for next time or clear.
};

const getFileUrl = (id) => `/file/${id}`;
const getMainImage = (product) => {
    try {
        if (!product.images) return null;
        const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
        return Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
    } catch { return null; }
};
</script>
