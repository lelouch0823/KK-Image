<template>
  <AppTable
    :columns="columns"
    :data="data"
    :loading="loading"
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
      <div class="font-medium text-(--text-main)">{{ value }}</div>
    </template>

    <!-- Store Cell -->
    <template #cell-store="{ value }">
      <span class="text-(--text-secondary)">{{ value || '-' }}</span>
    </template>

    <!-- Phone Cell -->
    <template #cell-phone="{ value }">
      <span class="text-(--text-secondary)">{{ value || '-' }}</span>
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
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            ></path>
          </svg>
        </button>
        <button
          class="hover:bg-info-bg hover:text-info rounded-lg p-1.5 text-(--text-secondary) transition-colors active:scale-90"
          :title="t('salesperson.edit')"
          @click.stop="$emit('edit', row)"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            ></path>
          </svg>
        </button>
        <button
          class="hover:bg-danger/10 hover:text-danger rounded-lg p-1.5 text-(--text-secondary) transition-colors active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
          :title="row.orderCount > 0 ? t('salesperson.cannotDeleteHasOrders') : t('common.delete')"
          :disabled="row.orderCount > 0"
          @click.stop="$emit('delete', row)"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            ></path>
          </svg>
        </button>
      </div>
    </template>
  </AppTable>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
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
