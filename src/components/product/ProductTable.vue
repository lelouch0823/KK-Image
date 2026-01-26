<template>
  <table class="w-full border-collapse">
    <thead class="sticky top-0 z-10 border-b border-[var(--border-color)] bg-[var(--bg-muted)]/90 backdrop-blur-md">
      <tr>
        <th class="rounded-tl-xl px-6 py-4 text-center text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">{{ t('product.table.header.product') }}</th>
        <th class="hidden px-6 py-4 text-center text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase md:table-cell">{{ t('product.form.sku') }}</th>
        <th class="hidden px-6 py-4 text-center text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase lg:table-cell">{{ t('product.table.header.category') }}</th>
        <th class="px-6 py-4 text-center text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">{{ t('product.table.header.price') }}</th>
        <th class="px-6 py-4 text-center text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">{{ t('product.table.header.stock') }}</th>
        <th class="px-6 py-4 text-center text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">{{ t('product.table.header.status') }}</th>
        <th class="hidden px-6 py-4 text-center text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase xl:table-cell">{{ t('common.updated') }}</th>
        <th class="rounded-tr-xl p-4 pr-8 text-center text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">{{ t('product.table.header.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-border-subtle bg-[var(--bg-card)]/50 divide-y">
      <tr 
        v-for="product in products" 
        :key="product.id"
        class="group cursor-pointer transition-colors duration-200 hover:bg-[var(--bg-hover)]"
        @click="$emit('view', product)"
      >
        <!-- Product Info -->
        <td class="max-w-[300px] px-6 py-4">
            <div class="flex items-center justify-center gap-4">
                <div class="relative size-12 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] transition-all group-hover:shadow-md">
                    <AppImage 
                        v-if="getMainImage(product)" 
                        :src="getFileUrl(getMainImage(product))" 
                        fit="cover"
                        class="product-table-image size-full"
                        rounded="none"
                    >
                         <template #placeholder>
                             <div class="flex size-full items-center justify-center bg-[var(--bg-muted)] text-[var(--text-muted)]">
                                 <svg class="size-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                 </svg>
                             </div>
                         </template>
                    </AppImage>
                    <div v-else class="flex h-full items-center justify-center text-[var(--text-muted)]">
                        <svg class="size-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                </div>
                <div class="min-w-0 flex-1 text-left">
                    <div class="truncate font-[Outfit] font-medium text-[var(--text-main)]" :title="product.name">{{ product.name }}</div>
                    <div class="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                        <span v-if="product.brand" class="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[var(--text-secondary)]">{{ product.brand }}</span>
                        <!-- Mobile Category fallback -->
                        <span v-if="product.category && !isLargeScreen" class="lg:hidden">{{ product.category }}</span>
                    </div>
                </div>
            </div>
        </td>

        <!-- SKU (Tablet+) -->
        <td class="hidden px-6 py-4 md:table-cell">
            <div class="flex flex-col items-center gap-1">
                <div class="w-fit rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-sm text-[var(--text-main)] dark:bg-[var(--bg-secondary)]">
                    {{ product.sku }}
                </div>
            </div>
        </td>

        <!-- Category (Large screens+) -->
        <td class="hidden px-6 py-4 text-center lg:table-cell">
             <span v-if="product.category" class="inline-flex items-center rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-info-text)]">
                {{ product.category }}
             </span>
             <span v-else class="text-[var(--text-muted)]">-</span>
        </td>

        <!-- Price -->
        <td class="px-6 py-4 text-center whitespace-nowrap">
            <div class="font-medium text-[var(--text-main)]">¥{{ product.price }}</div>
            <div v-if="product.cost_price" class="text-xs text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                CPP: ¥{{ product.cost_price }}
            </div>
        </td>

        <!-- Stock (Optimized Compact) -->
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center justify-center gap-2">
                <div :class="getStockColor(product)" class="text-sm font-semibold">
                    {{ product.stock_quantity || 0 }}
                </div>
                <!-- Low stock indicator dot -->
                <div
v-if="(product.stock_quantity || 0) <= (product.alert_threshold || 10)" 
                     class="size-2 animate-pulse rounded-full"
                     :class="(product.stock_quantity || 0) === 0 ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-warning)]'"
                     :title="t('product.text.lowStock')"
                ></div>
            </div>
        </td>

        <!-- Status -->
        <td class="px-6 py-4 text-center whitespace-nowrap">
            <span 
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize"
                :class="getStatusClass(product.status)"
            >
                <span class="mr-1.5 size-1.5 rounded-full" :class="getStatusDot(product.status)"></span>
                {{ t(`product.filters.status.${product.status}`) }}
            </span>
        </td>

        <!-- Updated At (XL screens+) -->
        <td class="hidden px-6 py-4 text-center text-xs whitespace-nowrap text-[var(--text-secondary)] xl:table-cell">
            {{ formatRelativeTime(product.updated_at, t) }}
        </td>

        <!-- Actions -->
        <td class="p-4 pr-8 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button 
                  class="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)]"
                  :title="t('common.edit') || 'Edit'"
                  @click.stop="$emit('edit', product)"
                >
                    <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button 
                  class="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                  :title="t('common.delete') || 'Delete'"
                  @click.stop="$emit('delete', product)"
                >
                    <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </td>
      </tr>
      
      <!-- Empty State -->
      <tr v-if="products.length === 0">
        <td colspan="8" class="px-6 py-12 text-center text-[var(--text-muted)]">
            <div class="flex flex-col items-center gap-2">
                <svg class="size-12 text-[var(--text-muted)] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                <p>{{ t('product.table.empty') }}</p>
            </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';
import { formatRelativeTime } from '@/utils/formatters';
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core';

const { t } = useI18n();
defineProps({
    products: { type: Array, default: () => [] }
});
defineEmits(['edit', 'delete', 'view']);

const breakpoints = useBreakpoints(breakpointsTailwind);
const isLargeScreen = breakpoints.greater('lg');

const getFileUrl = (id) => `/file/${id}`;
const getMainImage = (product) => {
    try {
        if (!product.images) return null;
        const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
        return Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
    } catch { return null; }
};

const getStockColor = (p) => {
    const qty = p.stock_quantity || 0;
    const threshold = p.alert_threshold || 10;
    if (qty === 0) return 'text-[var(--color-danger)] font-bold';
    if (qty <= threshold) return 'text-[var(--color-warning)] font-bold';
    return 'text-[var(--text-main)]';
};

const getStatusClass = (s) => {
    switch (s) {
        case 'active': return 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--border-success)]';
        case 'draft': return 'bg-[var(--bg-muted)] text-[var(--text-secondary)] border-[var(--border-color)]';
        case 'archived': return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--border-warning)]';
        default: return 'bg-[var(--bg-muted)] text-[var(--text-secondary)]';
    }
}

const getStatusDot = (s) => {
    switch (s) {
        case 'active': return 'bg-[var(--color-success)]';
        case 'draft': return 'bg-[var(--text-muted)]';
        case 'archived': return 'bg-[var(--color-warning)]';
        default: return 'bg-[var(--text-muted)]';
    }
}
</script>

<style scoped>
:deep(.product-table-image .app-image__img) {
  @apply transform transition-transform duration-500 group-hover:scale-110;
}
</style>
