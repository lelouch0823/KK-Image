<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <!-- Total Products -->
    <div class="group relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('product.stats.total_products') }}</h3>
          <div class="font-[Outfit] text-3xl font-bold text-slate-800 dark:text-white">
            {{ totalFormatted }}
          </div>
        </div>
        <div class="rounded-xl bg-indigo-50 p-3 text-indigo-500 dark:bg-indigo-900/20">
           <svg xmlns="http://www.w3.org/2000/svg" class="size-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
           </svg>
        </div>
      </div>
      <div class="mt-4 flex items-center text-xs font-medium text-green-500">
         <span class="flex items-center">
            <svg class="mr-1 size-3 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {{ t('product.stats.active_catalog') }}
         </span>
      </div>
    </div>

    <!-- Low Stock Alert -->
    <div class="group relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('product.stats.low_stock') }}</h3>
          <div class="font-[Outfit] text-3xl font-bold text-slate-800 dark:text-white">
            {{ lowStockCount }}
          </div>
        </div>
        <div class="rounded-xl bg-amber-50 p-3 text-amber-500 dark:bg-amber-900/20">
           <svg xmlns="http://www.w3.org/2000/svg" class="size-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
        </div>
      </div>
      <div class="mt-4 flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
         {{ t('product.stats.needs_attention') }}
      </div>
    </div>

    <!-- Total Value (Est) -->
    <div class="group relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('product.stats.total_value') }}</h3>
          <div class="font-[Outfit] text-3xl font-bold text-slate-800 dark:text-white">
            ¥{{ valueFormatted }}
          </div>
        </div>
        <div class="rounded-xl bg-emerald-50 p-3 text-emerald-500 dark:bg-emerald-900/20">
           <svg xmlns="http://www.w3.org/2000/svg" class="size-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
        </div>
      </div>
      <div class="mt-4 flex items-center text-xs font-medium text-slate-400">
         {{ t('product.stats.cost_basis') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const { products, pagination } = useProducts();

const totalFormatted = computed(() => {
    return pagination.total.toLocaleString();
});

const lowStockCount = computed(() => {
    return products.value.filter(p => (p.stock_quantity || 0) < (p.alert_threshold || 10)).length;
});

const valueFormatted = computed(() => {
    const total = products.value.reduce((acc, p) => acc + (p.cost_price || 0) * (p.stock_quantity || 0), 0);
    return total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
});
</script>
