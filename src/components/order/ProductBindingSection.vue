<template>
  <div class="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
    <h4 class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
      <svg class="size-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      {{ t('order.binding.title') }}
    </h4>

    <!-- Bound Product Card -->
    <div v-if="boundProduct" class="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-900/20">
      <div class="size-12 flex-shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-600">
        <AppImage 
          v-if="boundProduct.mainImage" 
          :src="boundProduct.mainImage" 
          fit="cover" 
          class="size-full" 
        />
        <div v-else class="flex h-full items-center justify-center text-slate-300">
          <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium text-slate-800 dark:text-slate-100">{{ boundProduct.name }}</div>
        <div class="mt-0.5 text-xs text-slate-500">{{ t('product.form.sku') }}: {{ boundProduct.sku }}</div>
      </div>
      <button 
        type="button" 
        class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
        :title="t('order.binding.unbind')"
        @click="$emit('unbind')"
      >
        <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Product Selector -->
    <div v-else>
      <p class="mb-2 text-xs text-slate-500">{{ t('order.binding.hint') }}</p>
      <ProductSelect @select="(p) => $emit('select', p)" />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import ProductSelect from '@/components/product/ProductSelect.vue';
import AppImage from '@/components/ui/AppImage.vue';

defineProps({
  boundProduct: { type: Object, default: null },
});

defineEmits(['select', 'unbind']);

const { t } = useI18n();
</script>
