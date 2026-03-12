<template>
  <AppTable
    :columns="columns"
    :data="data"
    :loading="loading"
    :row-class="rowClass"
    row-key="id"
    :empty-text="t('salesperson.emptyList')"
    no-border
    clickable
    @row-click="$emit('view-detail', $event)"
  >
    <template v-if="$slots.toolbar" #toolbar>
      <slot name="toolbar" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
    <!-- Name Cell -->
    <template #cell-name="{ value }">
      <div class="max-w-[12rem] truncate font-medium text-(--text-main)" :title="value || '-'">{{ value || '-' }}</div>
    </template>

    <!-- Store Cell -->
    <template #cell-store="{ value }">
      <span class="inline-block max-w-[12rem] truncate text-(--text-secondary)" :title="value || '-'">{{ value || '-' }}</span>
    </template>

    <!-- Phone Cell -->
    <template #cell-phone="{ value }">
      <span class="inline-block max-w-[10rem] truncate text-(--text-secondary)" :title="value || '-'">{{ value || '-' }}</span>
    </template>

    <!-- Order Count Cell -->
    <template #cell-orderCount="{ row, value }">
      <button
        v-if="value > 0"
        class="text-info cursor-pointer hover:underline"
        :title="t('salesperson.viewOrders')"
        @click.stop="$emit('view-orders', row)"
      >
        <StatusBadge variant="info">{{ value }}</StatusBadge>
      </button>
      <StatusBadge v-else variant="default">{{ value }}</StatusBadge>
    </template>

    <!-- Status Cell -->
    <template #cell-isActive="{ value }">
      <StatusBadge :variant="value ? 'success' : 'default'">
        {{ value ? t('salesperson.active') : t('salesperson.disabled') }}
      </StatusBadge>
    </template>

    <!-- Actions Cell -->
    <template #cell-actions="{ row }">
      <div class="mobile:opacity-100 flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          class="hover:text-primary hover:bg-(--bg-hover) rounded-lg p-1.5 text-(--text-secondary) transition-colors active:scale-90"
          :title="t('salesperson.copyLink')"
          @click.stop="$emit('copy', row.accessToken)"
        >
          <AppIcon name="clipboard" class="size-4" />
        </button>
        <button
          class="hover:bg-info-bg hover:text-info rounded-lg p-1.5 text-(--text-secondary) transition-colors active:scale-90"
          :title="t('salesperson.edit')"
          @click.stop="$emit('edit', row)"
        >
          <AppIcon name="pencil-alt" class="size-4" />
        </button>
        <button
          class="hover:bg-danger/10 hover:text-danger rounded-lg p-1.5 text-(--text-secondary) transition-colors active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
          :title="row.orderCount > 0 ? t('salesperson.cannotDeleteHasOrders') : t('common.delete')"
          :disabled="row.orderCount > 0"
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
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

defineProps({
  data: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  rowClass: {
    type: Function,
    default: () => '',
  },
});

defineEmits(['edit', 'delete', 'copy', 'view-orders', 'view-detail']);

const { t } = useI18n();

const columns = computed(() => [
  { key: 'name', label: t('salesperson.name'), align: 'left' },
  { key: 'store', label: t('salesperson.store'), align: 'left' },
  { key: 'phone', label: t('salesperson.phone'), align: 'left' },
  { key: 'orderCount', label: t('salesperson.orderCount'), align: 'left' },
  { key: 'isActive', label: t('salesperson.status'), align: 'center' },
  { key: 'actions', label: t('common.actions'), align: 'right' },
]);
</script>
