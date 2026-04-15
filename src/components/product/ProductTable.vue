<template>
  <AppTable
    :columns="columns"
    :data="products"
    :loading="loading"
    :no-border="true"
    :sort-by="sortBy"
    :sort-order="sortOrder"
    :row-class="rowClass"
    row-key="id"
    :empty-text="t('product.table.empty')"
    :virtual="products.length > 50"
    :estimate-size="64"
    table-layout="fixed"
    @row-click="$emit('view', $event)"
    @sort-change="$emit('sort-change', $event)"
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
        <div
          class="relative size-12 shrink-0 overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-muted) transition-all group-hover:shadow-md"
        >
          <AppImage
            v-if="getMainImageSrc(row)"
            :src="getMainImageSrc(row)"
            fit="cover"
            class="product-table-image size-full"
            rounded="none"
          >
            <template #placeholder>
              <div
                class="flex size-full items-center justify-center bg-(--bg-muted) text-(--text-muted)"
              >
                <AppIcon name="photo" class="size-4 animate-pulse" />
              </div>
            </template>
          </AppImage>
          <div v-else class="flex h-full items-center justify-center text-(--text-muted)">
            <AppIcon name="photo" class="size-6 text-(--text-muted)" />
          </div>
        </div>
        <div class="min-w-0 flex-1 text-left">
          <div class="truncate font-[Outfit] font-medium text-(--text-main)" :title="row.name">
            {{ row.name }}
          </div>
          <div class="mt-0.5 flex min-w-0 flex-wrap gap-2 text-xs text-(--text-secondary)">
            <span
              v-if="row.brand"
              class="max-w-[9rem] truncate rounded-md bg-(--bg-muted) px-1.5 py-0.5 text-(--text-secondary)"
              :title="row.brand"
              >{{ row.brand }}</span
            >
            <!-- Mobile Category fallback -->
            <span
              v-if="row.category && !isLargeScreen"
              class="max-w-[8rem] truncate lg:hidden"
              :title="row.category"
              >{{ row.category }}</span
            >
          </div>
        </div>
      </div>
    </template>

    <!-- SPU Cell -->
    <template #cell-spu="{ value }">
      <div class="flex min-w-0 flex-col items-center gap-1">
        <AppTableCodeChip :value="value" max-width="12rem" size="sm" tone="main" />
      </div>
    </template>

    <!-- Category Cell -->
    <template #cell-category="{ value }">
      <span
        v-if="value"
        class="bg-info-bg text-info inline-flex max-w-[10rem] items-center truncate whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
        :title="value"
      >
        {{ value }}
      </span>
      <span v-else class="text-(--text-muted)">-</span>
    </template>

    <!-- Price Cell -->
    <template #cell-price="{ row }">
      <div class="font-medium text-(--text-main)">¥{{ row.price }}</div>
      <div
        v-if="row.cost_price"
        class="text-xs text-(--text-muted) opacity-0 transition-opacity group-hover:opacity-100"
      >
        CPP: ¥{{ row.cost_price }}
      </div>
    </template>

    <!-- Stock Cell -->
    <template #cell-stock="{ row }">
      <div class="flex items-center justify-center gap-2">
        <div :class="getStockColor(row)" class="text-sm font-semibold">
          {{ resolveDisplayStock(row) }}
        </div>
        <!-- Low stock indicator dot -->
        <div
          v-if="resolveDisplayStock(row) <= resolveAlertThreshold(row)"
          class="size-2 animate-pulse rounded-full"
          :class="resolveDisplayStock(row) === 0 ? 'bg-danger' : 'bg-warning'"
          :title="t('product.text.lowStock')"
        ></div>
      </div>
    </template>

    <!-- Status Cell -->
    <template #cell-status="{ value }">
      <AppTableStatusPill
        :label="t(`product.filters.status.${value}`)"
        :title="t(`product.filters.status.${value}`)"
        :variant="getProductStatusVariant(value)"
        dot
        size="sm"
      />
    </template>

    <!-- Updated At Cell -->
    <template #cell-updatedAt="{ value }">
      <span class="text-xs text-(--text-secondary)">
        {{ formatRelativeTime(value, t) }}
      </span>
    </template>

    <!-- Actions Cell -->
    <template #cell-actions="{ row }">
      <div
        class="flex items-center justify-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
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
import AppTableCodeChip from '@/components/ui/AppTableCodeChip.vue';
import AppTableStatusPill from '@/components/ui/AppTableStatusPill.vue';
import { formatRelativeTime } from '@/utils/formatters';
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core';
import { resolvePrimaryProductImageSrc } from './image-resolver.js';
import { getProductStatusVariant } from '@/utils/product-status';

const { t } = useI18n();
defineProps({
  products: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  rowClass: { type: Function, default: () => '' },
  sortBy: { type: String, default: '' },
  sortOrder: { type: String, default: '' },
});
defineEmits(['edit', 'delete', 'view', 'share', 'sort-change']);

const breakpoints = useBreakpoints(breakpointsTailwind);
const isLargeScreen = breakpoints.greater('lg');

const columns = computed(() => [
  { key: 'product', label: t('product.table.header.product'), align: 'left', width: '300px' },
  {
    key: 'spu',
    label: t('product.form.spu'),
    kind: 'identifier',
    align: 'center',
    width: '180px',
    maxWidth: '180px',
    headerClass: 'hidden md:table-cell',
    cellClass: 'hidden md:table-cell',
  },
  {
    key: 'category',
    label: t('product.table.header.category'),
    align: 'center',
    width: '160px',
    maxWidth: '160px',
    headerClass: 'hidden lg:table-cell',
    cellClass: 'hidden lg:table-cell',
    nowrap: true,
  },
  { key: 'price', label: t('product.table.header.price'), align: 'center', sortable: true },
  {
    key: 'stock',
    label: t('product.table.header.stock'),
    kind: 'numeric',
    align: 'center',
    sortable: true,
  },
  {
    key: 'status',
    label: t('product.table.header.status'),
    kind: 'status',
    align: 'center',
    width: '96px',
    maxWidth: '96px',
  },
  {
    key: 'updatedAt',
    label: t('common.updated'),
    kind: 'datetime',
    align: 'center',
    headerClass: 'hidden xl:table-cell',
    cellClass: 'hidden xl:table-cell',
  },
  { key: 'actions', label: t('product.table.header.actions'), align: 'center', width: '100px' },
]);

// Note: For AppTable data access, we use slot scopes which give us `row`.
// So key names in `columns` correspond to slots like `#cell-spu`.
// Column `key` is mostly for slot naming.

const getMainImageSrc = (product) => resolvePrimaryProductImageSrc(product);

const resolveDisplayStock = (product) =>
  Number(product?.available_quantity ?? product?.available ?? product?.stock_quantity ?? 0);

const resolveAlertThreshold = (product) => {
  const numeric = Number(product?.alert_threshold);
  return Number.isFinite(numeric) ? numeric : 10;
};

const getStockColor = (p) => {
  const qty = resolveDisplayStock(p);
  const threshold = resolveAlertThreshold(p);
  if (qty === 0) return 'text-danger font-bold';
  if (qty <= threshold) return 'text-warning font-bold';
  return 'text-(--text-main)';
};
</script>

<style scoped>
:deep(.product-table-image .app-image__img) {
  @apply transform transition-transform duration-500 group-hover:scale-110;
}
</style>
