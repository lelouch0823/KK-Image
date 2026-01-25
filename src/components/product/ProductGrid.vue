<template>
  <div class="space-y-3">
    <div 
        v-for="product in products" 
        :key="product.id"
        class="group relative cursor-pointer overflow-hidden rounded-xl border border-border-subtle bg-surface p-4 shadow-sm transition-all duration-300 active:scale-[0.98] dark:border-border dark:bg-surface-muted"
        :class="getStatusBorderClass(product.status)"
        @click="$emit('edit', product)"
    >
        <div class="flex items-start gap-3">
            <!-- Image -->
            <div class="size-20  flex-shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
                 <img 
                    v-if="getMainImage(product)" 
                    :src="getFileUrl(getMainImage(product))" 
                    class="size-full  object-cover"
                    loading="lazy"
                />
                <div v-else class="flex size-full  items-center justify-center text-slate-300 dark:text-slate-600">
                    <svg class="size-8 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            </div>
            
            <!-- Info -->
            <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                    <h3 class="truncate text-[15px] leading-tight font-medium text-slate-900 dark:text-slate-100">
                        {{ product.name }}
                    </h3>
                </div>
                
                <div class="mt-1 flex items-center gap-2">
                    <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500 dark:bg-slate-700/50">
                        {{ product.sku }}
                    </span>
                    <span v-if="product.stock_quantity <= (product.alert_threshold || 10)" class="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-500 dark:bg-red-900/20">
                        {{ t('product.stats.low_stock') }}
                    </span>
                </div>
                
                <div class="mt-2.5 flex items-end justify-between">
                    <div class="flex items-center gap-2">
                        <StatusBadge :variant="getStatusVariant(product.status)" size="xs" :dot="true">
                            {{ t(`product.filters.status.${product.status}`) }}
                        </StatusBadge>
                    </div>
                    <div class="text-right">
                         <div class="font-bold text-slate-900 dark:text-white">¥{{ product.price }}</div>
                         <div class="text-[10px] text-slate-400">Inventory: {{ product.stock_quantity }}</div>
                    </div>
                </div>
            </div>

            <!-- Arrow -->
             <svg class="pointer-events-none absolute top-1/2 right-2 hidden size-5  -translate-y-1/2 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 sm:block dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
             </svg>
        </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const { t } = useI18n();
defineProps({
    products: Array
});
defineEmits(['edit']);

const getFileUrl = (id) => `/file/${id}`;
const getMainImage = (product) => {
    try {
        const imgs = JSON.parse(product.images || '[]');
        return imgs.length > 0 ? imgs[0] : null;
    } catch { return null; }
};

const getStatusVariant = (status) => {
    switch(status) {
        case 'active': return 'success';
        case 'draft': return 'warning'; // or default
        case 'archived': return 'default'; // or info
        default: return 'default';
    }
};

const getStatusBorderClass = (status) => {
    const variant = getStatusVariant(status);
    switch (variant) {
        case 'success': return 'border-l-4 border-l-emerald-500';
        case 'warning': return 'border-l-4 border-l-amber-500';
        case 'info': return 'border-l-4 border-l-sky-500';
        case 'error': return 'border-l-4 border-l-rose-500'; // if needed
        default: return 'border-l-4 border-l-slate-300 dark:border-l-slate-600';
    }
};
</script>
