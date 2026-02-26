<template>
  <div class="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
    <!-- Total Products -->
    <div class="group relative overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-info/10 hover:shadow-xl sm:p-6">
      <div class="relative z-10 flex items-start justify-between">
        <div>
          <h3 class="text-sm font-medium text-(--text-secondary)">{{ t('product.stats.total_products') }}</h3>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-(--text-main) sm:text-4xl">
            {{ totalFormatted }}
          </div>
        </div>
        <div class="bg-info/10 text-info group-hover:bg-info group-hover:text-(--text-inverse) flex size-10 items-center justify-center rounded-xl transition-colors sm:size-12">
            <AppIcon name="cube" class="size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6" />
        </div>
      </div>
      <div class="text-success-text relative z-10 mt-4 flex items-center gap-1.5 text-xs font-medium">
         <span class="bg-success-bg flex items-center gap-1 rounded-full px-2 py-0.5">
            <AppIcon name="trending-up" class="size-3.5" />
            {{ t('product.stats.active_catalog') }}
         </span>
      </div>
      
      <!-- Decorative Gradient Blob -->
      <div class="bg-info/10 absolute -top-6 -right-6 -z-0 size-32 rounded-full opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
    </div>

    <!-- Low Stock Alert -->
    <div class="group relative overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-warning/10 hover:shadow-xl sm:p-6">
      <div class="relative z-10 flex items-start justify-between">
        <div>
          <h3 class="text-sm font-medium text-(--text-secondary)">{{ t('product.stats.low_stock') }}</h3>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-(--text-main) sm:text-4xl">
            {{ lowStockCount }}
          </div>
        </div>
        <div class="bg-warning/10 text-warning group-hover:bg-warning group-hover:text-(--text-inverse) flex size-10 items-center justify-center rounded-xl transition-colors sm:size-12">
            <AppIcon name="exclamation-triangle" class="size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6" />
        </div>
      </div>
      <div class="text-warning-text relative z-10 mt-4 flex items-center text-xs font-medium">
         <span class="bg-warning-bg flex items-center gap-1 rounded-full px-2 py-0.5">
            {{ t('product.stats.needs_attention') }}
         </span>
      </div>

       <div class="bg-warning/10 absolute -top-6 -right-6 -z-0 size-32 rounded-full opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
    </div>

    <!-- Total Value (Est) -->
    <div class="group relative overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-success/10 hover:shadow-xl sm:p-6">
      <div class="relative z-10 flex items-start justify-between">
        <div>
          <h3 class="text-sm font-medium text-(--text-secondary)">{{ t('product.stats.total_value') }}</h3>
           <div class="mt-2 flex items-baseline gap-1">
             <span class="text-xl font-bold text-(--text-muted)">¥</span>
             <span class="font-[Outfit] text-3xl font-bold tracking-tight text-(--text-main) sm:text-4xl">{{ valueFormatted }}</span>
           </div>
        </div>
        <div class="bg-success/10 text-success group-hover:bg-success group-hover:text-(--text-inverse) flex size-10 items-center justify-center rounded-xl transition-colors sm:size-12">
            <AppIcon name="currency-dollar" class="size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6" />
        </div>
      </div>
      <div class="relative z-10 mt-4 flex items-center text-xs font-medium text-(--text-secondary)">
         <span class="bg-(--bg-muted) flex items-center gap-1 rounded-full px-2 py-0.5">
             {{ t('product.stats.cost_basis') }}
         </span>
      </div>

       <div class="bg-success/10 absolute -top-6 -right-6 -z-0 size-32 rounded-full opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

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
