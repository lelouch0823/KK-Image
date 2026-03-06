<template>
  <AppTable
    :columns="columns"
    :data="products"
    :loading="loading"
    :no-border="true"
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
        <div class="relative size-12 shrink-0 overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-muted) transition-all group-hover:shadow-md">
            <AppImage 
                v-if="getMainImageSrc(row)" 
                :src="getMainImageSrc(row)" 
                fit="cover"
                class="product-table-image size-full"
                rounded="none"
            >
                 <template #placeholder>
                     <div class="flex size-full items-center justify-center bg-(--bg-muted) text-(--text-muted)">
                         <AppIcon name="photo" class="size-4 animate-pulse" />
                     </div>
                 </template>
            </AppImage>
            <div v-else class="flex h-full items-center justify-center text-(--text-muted)">
                <AppIcon name="photo" class="size-6 text-(--text-muted)" />
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
            class="hover:bg-primary/10 text-primary rounded-lg p-1.5 transition-colors"
            :title="t('spaceManager.quickShare') || 'Share'"
            @click.stop="$emit('share', row)"
          >
              <AppIcon name="share" class="size-4" />
          </button>
          <button 
            class="hover:bg-info-bg hover:text-info rounded-lg p-1.5 text-(--text-muted) transition-colors"
            :title="t('common.edit') || 'Edit'"
            @click.stop="$emit('edit', row)"
          >
              <AppIcon name="pencil-square" class="size-4" />
          </button>
          <button 
            class="hover:bg-danger-bg hover:text-danger rounded-lg p-1.5 text-(--text-muted) transition-colors"
            :title="t('common.delete') || 'Delete'"
            @click.stop="$emit('delete', row)"
          >
              <AppIcon name="trash" class="size-4" />
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
import { resolvePrimaryProductImageSrc } from './image-resolver.js';

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

const getMainImageSrc = (product) => resolvePrimaryProductImageSrc(product);

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
