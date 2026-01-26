<template>
  <div ref="containerRef" class="relative w-full">
    <!-- Input Field -->
    <div class="relative">
      <div 
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
      >
        <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        v-model="searchQuery"
        type="text"
        class="w-full rounded-lg border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        :placeholder="t('product.filters.search_placeholder') || 'Search products...'"
        @focus="open"
        @input="handleInput"
      />
      
      <!-- Loading Indicator -->
      <div v-if="loading" class="absolute inset-y-0 right-0 flex items-center pr-3">
        <svg class="size-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
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
        class="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-100 bg-white/90 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/95 dark:ring-white/5"
      >
        <!-- Empty State -->
        <div v-if="!loading && products.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
          {{ t('common.noData') }}
        </div>

        <!-- List -->
        <ul v-else class="space-y-1">
          <li
            v-for="product in products"
            :key="product.id"
            class="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
            @click="select(product)"
          >
            <!-- Image -->
            <div class="relative size-10 flex-shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
               <AppImage 
                  v-if="getMainImage(product)" 
                  :src="getFileUrl(getMainImage(product))" 
                  fit="cover"
                  class="size-full"
               />
               <div v-else class="flex h-full items-center justify-center text-slate-300">
                  <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               </div>
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between">
                <span class="truncate font-medium text-slate-700 dark:text-slate-200">{{ product.name }}</span>
                <span class="ml-2 flex-shrink-0 text-xs text-slate-400">¥{{ product.price }}</span>
              </div>
              <div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-700/50 dark:text-slate-400">{{ product.sku }}</span>
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

defineProps({
  modelValue: { type: String, default: '' }, // existing code compatibility
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
    await loadProducts({ search: query, limit: 10, page: 1 });
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
