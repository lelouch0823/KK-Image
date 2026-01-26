<template>
  <div class="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
    <!-- Total Products -->
    <div class="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-5 sm:p-6 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-800/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10">
      <div class="relative z-10 flex items-start justify-between">
        <div>
          <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('product.stats.total_products') }}</h3>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {{ totalFormatted }}
          </div>
        </div>
        <div class="flex size-10 sm:size-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 transition-colors group-hover:bg-indigo-500 group-hover:text-white dark:bg-indigo-500/20 dark:text-indigo-400 dark:group-hover:bg-indigo-500/80 dark:group-hover:text-white">
           <svg xmlns="http://www.w3.org/2000/svg" class="size-5 sm:size-6 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
           </svg>
        </div>
      </div>
      <div class="relative z-10 mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
         <span class="flex items-center gap-1 rounded-full bg-emerald-100/50 px-2 py-0.5 dark:bg-emerald-500/10">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {{ t('product.stats.active_catalog') }}
         </span>
      </div>
      
      <!-- Decorative Gradient Blob -->
      <div class="absolute -right-6 -top-6 -z-0 size-32 rounded-full bg-indigo-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-indigo-500/5 opacity-50"></div>
    </div>

    <!-- Low Stock Alert -->
    <div class="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-5 sm:p-6 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-800/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10">
      <div class="relative z-10 flex items-start justify-between">
        <div>
          <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('product.stats.low_stock') }}</h3>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {{ lowStockCount }}
          </div>
        </div>
        <div class="flex size-10 sm:size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white dark:bg-amber-500/20 dark:text-amber-400 dark:group-hover:bg-amber-500/80 dark:group-hover:text-white">
           <svg xmlns="http://www.w3.org/2000/svg" class="size-5 sm:size-6 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
        </div>
      </div>
      <div class="relative z-10 mt-4 flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
         <span class="flex items-center gap-1 rounded-full bg-amber-100/50 px-2 py-0.5 dark:bg-amber-500/10">
            {{ t('product.stats.needs_attention') }}
         </span>
      </div>

       <div class="absolute -right-6 -top-6 -z-0 size-32 rounded-full bg-amber-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-amber-500/5 opacity-50"></div>
    </div>

    <!-- Total Value (Est) -->
    <div class="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-5 sm:p-6 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-800/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10">
      <div class="relative z-10 flex items-start justify-between">
        <div>
          <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('product.stats.total_value') }}</h3>
           <div class="mt-2 flex items-baseline gap-1">
             <span class="text-xl font-bold text-slate-400 dark:text-slate-500">¥</span>
             <span class="font-[Outfit] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{{ valueFormatted }}</span>
           </div>
        </div>
        <div class="flex size-10 sm:size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white dark:bg-emerald-500/20 dark:text-emerald-400 dark:group-hover:bg-emerald-500/80 dark:group-hover:text-white">
           <svg xmlns="http://www.w3.org/2000/svg" class="size-5 sm:size-6 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
        </div>
      </div>
      <div class="relative z-10 mt-4 flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
         <span class="flex items-center gap-1 rounded-full bg-slate-100/50 px-2 py-0.5 dark:bg-slate-700/30">
             {{ t('product.stats.cost_basis') }}
         </span>
      </div>

       <div class="absolute -right-6 -top-6 -z-0 size-32 rounded-full bg-emerald-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-emerald-500/5 opacity-50"></div>
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
