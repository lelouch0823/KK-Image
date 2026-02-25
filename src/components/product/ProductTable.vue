<template>
  <AppTable
    :columns="columns"
    :data="products"
    :loading="loading"
    row-key="id"
    :empty-text="t('product.table.empty')"
    :virtual="products.length > 50"
    :estimate-size="64"
    @row-click="$emit('view', $event)"
  >
    <template #toolbar>
      <slot name="toolbar" />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
    <!-- Product Info Cell -->
    <template #cell-product="{ row }">
      <div class="flex items-center gap-4">
        <div class="relative size-12 flex-shrink-0 overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-muted) transition-all group-hover:shadow-md">
            <AppImage 
                v-if="getMainImage(row)" 
                :src="getFileUrl(getMainImage(row))" 
                fit="cover"
                class="product-table-image size-full"
                rounded="none"
            >
                 <template #placeholder>
                     <div class="flex size-full items-center justify-center bg-(--bg-muted) text-(--text-muted)">
                         <svg class="size-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                         </svg>
                     </div>
                 </template>
            </AppImage>
            <div v-else class="flex h-full items-center justify-center text-(--text-muted)">
                <svg class="size-6 text-(--text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
        </div>
        <div class="min-w-0 flex-1 text-left">
            <div class="truncate font-[Outfit] font-medium text-(--text-main)" :title="row.name">{{ row.name }}</div>
            <div class="mt-0.5 flex flex-wrap gap-2 text-xs text-(--text-secondary)">
                <span v-if="row.brand" class="rounded-md bg-(--bg-muted) px-1.5 py-0.5 text-(--text-secondary)">{{ row.brand }}</span>
                <!-- Mobile Category fallback -->
                <span v-if="row.category && !isLargeScreen" class="lg:hidden">{{ row.category }}</span>
            </div>
        </div>
      </div>
    </template>

    <!-- SPU Cell -->
    <template #cell-spu="{ value }">
      <div class="flex flex-col items-center gap-1">
          <div class="w-fit rounded bg-(--bg-muted) px-2 py-0.5 font-mono text-sm text-(--text-main) dark:bg-(--bg-secondary)">
              {{ value }}
          </div>
      </div>
    </template>

    <!-- Category Cell -->
    <template #cell-category="{ value }">
       <span v-if="value" class="bg-info-bg text-info inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
          {{ value }}
       </span>
       <span v-else class="text-(--text-muted)">-</span>
    </template>

    <!-- Price Cell -->
    <template #cell-price="{ row }">
      <div class="font-medium text-(--text-main)">¥{{ row.price }}</div>
      <div v-if="row.cost_price" class="text-xs text-(--text-muted) opacity-0 transition-opacity group-hover:opacity-100">
          CPP: ¥{{ row.cost_price }}
      </div>
    </template>

    <!-- Stock Cell -->
    <template #cell-stock="{ row }">
      <div class="flex items-center justify-center gap-2">
          <div :class="getStockColor(row)" class="text-sm font-semibold">
              {{ row.stock_quantity || 0 }}
          </div>
          <!-- Low stock indicator dot -->
          <div
               v-if="(row.stock_quantity || 0) <= (row.alert_threshold || 10)" 
               class="size-2 animate-pulse rounded-full"
               :class="(row.stock_quantity || 0) === 0 ? 'bg-danger' : 'bg-warning'"
               :title="t('product.text.lowStock')"
          ></div>
      </div>
    </template>

    <!-- Status Cell -->
    <template #cell-status="{ value }">
      <span 
          class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize"
          :class="getStatusClass(value)"
      >
          <span class="mr-1.5 size-1.5 rounded-full" :class="getStatusDot(value)"></span>
          {{ t(`product.filters.status.${value}`) }}
      </span>
    </template>

    <!-- Updated At Cell -->
    <template #cell-updatedAt="{ value }">
      <span class="text-xs text-(--text-secondary)">
        {{ formatRelativeTime(value, t) }}
      </span>
    </template>

    <!-- Actions Cell -->
    <template #cell-actions="{ row }">
      <div class="flex items-center justify-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button 
            class="hover:bg-primary/10 rounded-lg p-1.5 text-[var(--color-primary)] transition-colors"
            :title="t('spaceManager.quickShare') || 'Share'"
            @click.stop="$emit('share', row)"
          >
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          </button>
          <button 
            class="hover:bg-info-bg hover:text-info rounded-lg p-1.5 text-(--text-muted) transition-colors"
            :title="t('common.edit') || 'Edit'"
            @click.stop="$emit('edit', row)"
          >
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button 
            class="hover:bg-danger-bg hover:text-danger rounded-lg p-1.5 text-(--text-muted) transition-colors"
            :title="t('common.delete') || 'Delete'"
            @click.stop="$emit('delete', row)"
          >
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
      </div>
    </template>
  </AppTable>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppTable from '@/components/ui/AppTable.vue';
import AppImage from '@/components/ui/AppImage.vue';
import { formatRelativeTime } from '@/utils/formatters';
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core';

const { t } = useI18n();
defineProps({
    products: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
});
defineEmits(['edit', 'delete', 'view', 'share']);

const breakpoints = useBreakpoints(breakpointsTailwind);
const isLargeScreen = breakpoints.greater('lg');

const columns = computed(() => [
  { key: 'product', label: t('product.table.header.product'), align: 'left', width: '300px' },
  { key: 'spu', label: t('product.form.spu'), align: 'center', class: 'hidden md:table-cell' },
  { key: 'category', label: t('product.table.header.category'), align: 'center', class: 'hidden lg:table-cell' },
  { key: 'price', label: t('product.table.header.price'), align: 'center' },
  { key: 'stock', label: t('product.table.header.stock'), align: 'center' },
  { key: 'status', label: t('product.table.header.status'), align: 'center' },
  { key: 'updatedAt', label: t('common.updated'), align: 'center', class: 'hidden xl:table-cell' }, // Mapped from updated_at to updatedAt in template slot? No, access raw row.
  { key: 'actions', label: t('product.table.header.actions'), align: 'center', width: '100px' },
]);

// Note: For AppTable data access, we use slot scopes which give us `row`.
// So key names in `columns` correspond to slots like `#cell-spu`. 
// Column `key` is mostly for slot naming. 

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
    if (qty === 0) return 'text-danger font-bold';
    if (qty <= threshold) return 'text-warning font-bold';
    return 'text-(--text-main)';
};

const getStatusClass = (s) => {
    switch (s) {
        case 'active': return 'bg-success-bg text-success-text border-success';
        case 'draft': return 'bg-(--bg-muted) text-(--text-secondary) border-(--border-color)';
        case 'archived': return 'bg-warning-bg text-warning-text border-warning';
        default: return 'bg-(--bg-muted) text-(--text-secondary)';
    }
}

const getStatusDot = (s) => {
    switch (s) {
        case 'active': return 'bg-success';
        case 'draft': return 'bg-(--text-muted)';
        case 'archived': return 'bg-warning';
        default: return 'bg-(--text-muted)';
    }
}
</script>

<style scoped>
:deep(.product-table-image .app-image__img) {
  @apply transform transition-transform duration-500 group-hover:scale-110;
}
</style>
