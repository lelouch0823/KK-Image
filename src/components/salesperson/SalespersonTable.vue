<template>
  <AppTable
    :columns="columns"
    :data="data"
    :loading="loading"
    :row-class="rowClass"
    row-key="id"
    :empty-text="t('salesperson.emptyList')"
    :virtual="data.length > 50"
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
      <div class="max-w-[12rem] truncate font-medium text-(--text-main)" :title="value || '-'">
        {{ value || '-' }}
      </div>
    </template>

    <!-- Store Cell -->
    <template #cell-store="{ value }">
      <span
        class="inline-block max-w-[12rem] truncate text-(--text-secondary)"
        :title="value || '-'"
        >{{ value || '-' }}</span
      >
    </template>

    <!-- Phone Cell -->
    <template #cell-phone="{ value }">
      <span
        class="inline-block max-w-[10rem] truncate text-(--text-secondary)"
        :title="value || '-'"
        >{{ value || '-' }}</span
      >
    </template>

    <!-- Order Count Cell -->
    <template #cell-orderCount="{ row, value }">
      <AppButton
        v-if="value > 0"
        variant="link"
        size="sm"
        class="!h-auto !px-0 text-info"
        :title="t('salesperson.viewOrders')"
        @click.stop="$emit('view-orders', row)"
      >
        <StatusBadge variant="info">{{ value }}</StatusBadge>
      </AppButton>
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
      <div
        class="mobile:opacity-100 flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
      >
        <AppButton
          variant="ghost"
          size="sm"
          class="!h-8 !w-8 !px-0"
          :title="t('salesperson.copyLink')"
          @click.stop="$emit('copy', row.accessToken)"
        >
          <template #icon-left>
            <AppIcon name="clipboard" class="size-4" />
          </template>
        </AppButton>
        <AppButton
          v-if="canManage"
          variant="ghost"
          size="sm"
          class="!h-8 !w-8 !px-0 hover:bg-info-bg hover:text-info"
          :title="t('salesperson.edit')"
          @click.stop="$emit('edit', row)"
        >
          <template #icon-left>
            <AppIcon name="pencil-alt" class="size-4" />
          </template>
        </AppButton>
        <AppButton
          v-if="canManage"
          variant="ghost"
          size="sm"
          class="!h-8 !w-8 !px-0 hover:bg-danger/10 hover:text-danger"
          :title="row.orderCount > 0 ? t('salesperson.cannotDeleteHasOrders') : t('common.delete')"
          :disabled="row.orderCount > 0"
          @click.stop="$emit('delete', row)"
        >
          <template #icon-left>
            <AppIcon name="trash" class="size-4" />
          </template>
        </AppButton>
      </div>
    </template>
  </AppTable>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
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
  canManage: {
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
