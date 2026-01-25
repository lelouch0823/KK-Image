<template>
  <table class="w-full border-collapse">
    <thead class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
      <tr>
        <th class="rounded-tl-xl px-6 py-4 pl-8 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">{{ t('product.table.header.product') }}</th>
        <th class="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">SKU / Slug</th>
        <th class="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">{{ t('product.table.header.price') }}</th>
        <th class="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">{{ t('product.table.header.stock') }}</th>
        <th class="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">{{ t('product.table.header.status') }}</th>
        <th class="rounded-tr-xl px-6 py-4 pr-8 text-right text-xs font-semibold tracking-wider text-slate-500 uppercase">{{ t('product.table.header.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-border-subtle bg-surface/50 dark:divide-border-subtle dark:bg-slate-800/50">
      <tr 
        v-for="product in products" 
        :key="product.id"
        class="group transition-colors duration-200 hover:bg-surface dark:hover:bg-slate-800"
      >
        <!-- Product Info -->
        <td class="px-6 py-4 pl-8">
            <div class="flex items-center gap-4">
                <div class="relative size-12  flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition-all group-hover:shadow-md dark:border-slate-600 dark:bg-slate-700">
                    <!-- Image Logic (parse JSON) -->
                    <img 
                        v-if="getMainImage(product)" 
                        :src="getFileUrl(getMainImage(product))" 
                        class="size-full  transform object-cover transition-transform duration-500 group-hover:scale-110"
                        alt=""
                    />
                    <div v-else class="flex h-full items-center justify-center text-slate-400">
                        <svg class="size-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                </div>
                <div>
                    <div class="font-[Outfit] font-medium text-slate-900 dark:text-slate-100">{{ product.name }}</div>
                    <div class="mt-0.5 flex gap-2 text-xs text-slate-500">
                        <span v-if="product.brand" class="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{{ product.brand }}</span>
                        <span v-if="product.series">{{ product.series }}</span>
                    </div>
                </div>
            </div>
        </td>

        <!-- SKU / Slug -->
        <td class="px-6 py-4">
            <div class="flex flex-col gap-1">
                <div class="w-fit rounded bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {{ product.sku }}
                </div>
                <div class="max-w-[120px] truncate text-xs text-slate-400" :title="product.slug">
                    /{{ product.slug || '-' }}
                </div>
            </div>
        </td>

        <!-- Price -->
        <td class="px-6 py-4">
            <div class="font-medium text-slate-900 dark:text-slate-100">¥{{ product.price }}</div>
            <div v-if="product.cost_price" class="text-xs text-slate-400">Cost: ¥{{ product.cost_price }}</div>
        </td>

        <!-- Stock -->
        <td class="w-48 px-6 py-4">
            <div class="flex flex-col gap-1.5">
                <div class="mb-1 flex justify-between text-xs">
                    <span :class="getStockColor(product)">{{ product.stock_quantity }} units</span>
                </div>
                <!-- Progress Bar -->
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div 
                        class="h-full rounded-full transition-all duration-500"
                        :class="getStockBg(product)"
                        :style="{ width: Math.min((product.stock_quantity / 100) * 100, 100) + '%' }"
                    ></div>
                </div>
            </div>
        </td>

        <!-- Status -->
        <td class="px-6 py-4">
            <span 
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize"
                :class="getStatusClass(product.status)"
            >
                <span class="mr-1.5 size-1.5  rounded-full" :class="getStatusDot(product.status)"></span>
                {{ t(`product.filters.status.${product.status}`) }}
            </span>
        </td>

        <!-- Actions -->
        <td class="px-6 py-4 pr-8 text-right">
            <div class="flex items-center justify-end gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button 
                  class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30"
                  :title="t('common.edit') || 'Edit'"
                  @click="$emit('edit', product)"
                >
                    <svg class="size-4 " fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button 
                  class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  :title="t('common.delete') || 'Delete'"
                  @click="$emit('delete', product)"
                >
                    <svg class="size-4 " fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </td>
      </tr>
      
      <!-- Empty State -->
      <tr v-if="products.length === 0">
        <td colspan="6" class="px-6 py-12 text-center text-slate-400">
            <div class="flex flex-col items-center gap-2">
                <svg class="size-12  text-slate-300 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                <p>{{ t('product.table.empty') }}</p>
            </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const props = defineProps({
    products: { type: Array, default: () => [] }
});
defineEmits(['edit', 'delete']);

const getFileUrl = (id) => `/file/${id}`;
const getMainImage = (product) => {
    try {
        const imgs = JSON.parse(product.images || '[]');
        return imgs.length > 0 ? imgs[0] : null;
    } catch { return null; }
};

const getStockColor = (p) => {
    const qty = p.stock_quantity || 0;
    const threshold = p.alert_threshold || 10;
    if (qty === 0) return 'text-red-600 font-bold';
    if (qty < threshold) return 'text-amber-600 font-medium';
    return 'text-slate-600 dark:text-slate-400';
};

const getStockBg = (p) => {
    const qty = p.stock_quantity || 0;
    const threshold = p.alert_threshold || 10;
    if (qty === 0) return 'bg-red-500';
    if (qty < threshold) return 'bg-amber-500';
    return 'bg-emerald-500';
};

const getStatusClass = (s) => {
    switch (s) {
        case 'active': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
        case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
        case 'archived': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
        default: return 'bg-slate-100 text-slate-600';
    }
}

const getStatusDot = (s) => {
    switch (s) {
        case 'active': return 'bg-green-500';
        case 'draft': return 'bg-slate-500';
        case 'archived': return 'bg-amber-500';
        default: return 'bg-slate-400';
    }
}
</script>
