<template>
  <div ref="containerRef" class="relative w-full">
    <!-- Input Field -->
    <div class="relative">
      <div 
        class="text-(--text-muted) pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
      >
        <AppIcon name="magnifying-glass" class="size-5" />
      </div>
      <input
        v-model="searchQuery"
        type="text"
        class="border-(--border-color) bg-(--bg-muted) text-(--text-main) placeholder:text-(--text-muted) focus:border-primary focus:bg-(--bg-card) focus:ring-primary w-full rounded-lg py-2.5 pr-4 pl-10 text-sm transition-colors focus:ring-1 focus:outline-none"
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
        class="border-(--border-subtle) bg-(--bg-card)/90 absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur-xl"
      >
        <!-- Empty State -->
        <div v-if="!loading && products.length === 0" class="text-(--text-muted) px-4 py-8 text-center text-sm">
          {{ t('common.noData') }}
        </div>

        <!-- List -->
        <ul v-else class="space-y-1">
          <li
            v-for="product in products"
            :key="product.id"
            class="hover:bg-(--bg-hover) group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors"
            @click="select(product)"
          >
            <!-- Image -->
            <div class="border-(--border-color) bg-(--bg-muted) relative size-10 shrink-0 overflow-hidden rounded-md border">
               <AppImage 
                  v-if="getMainImage(product)" 
                  :src="getFileUrl(getMainImage(product))" 
                  fit="cover"
                  class="size-full"
               />
               <div v-else class="text-(--text-muted) flex h-full items-center justify-center">
                  <AppIcon name="photo" class="size-5" />
               </div>
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between">
                <span class="text-(--text-main) truncate font-medium">{{ product.name }}</span>
                <span class="text-(--text-muted) ml-2 shrink-0 text-xs">¥{{ product.price }}</span>
              </div>
              <div class="text-(--text-secondary) mt-0.5 flex items-center gap-2 text-xs">
                <span class="bg-(--bg-muted) rounded px-1.5 py-0.5 font-mono">{{ product.spu }}</span>
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
