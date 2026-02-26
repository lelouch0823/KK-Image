<template>
  <AppTable
    :columns="columns"
    :data="data"
    :loading="loading"
    row-key="id"
    class="h-full"
    :virtual="data.length > 50"
    :estimate-size="64"
    @row-click="$emit('detail', $event)"
  >
    <template #toolbar>
      <slot name="toolbar" />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
    <!-- Custom Header for Selection -->
    <template #header-selection>
      <div class="flex items-center justify-center">
        <input
          type="checkbox"
          :checked="isAllSelected"
          :indeterminate="isPartialSelected"
          class="text-primary size-4 cursor-pointer rounded-lg border-(--border-color) bg-(--bg-muted) transition-all focus:ring-primary/20"
          @change="toggleSelectAll"
        />
      </div>
    </template>

    <!-- Selection Cell -->
    <template #cell-selection="{ row }">
      <div class="flex items-center justify-center" @click.stop>
        <input
          type="checkbox"
          :checked="isSelected(row.id)"
          class="text-primary size-4 cursor-pointer rounded-lg border-(--border-color) bg-(--bg-muted) transition-all focus:ring-primary/20"
          @change="toggleSelect(row.id)"
        />
      </div>
    </template>

    <!-- Product Info Cell -->
    <template #cell-product="{ row }">
      <div class="flex items-center gap-3">
        <!-- Thumbnail -->
        <div
          class="size-10 flex-shrink-0 overflow-hidden rounded border border-(--border-color) bg-(--bg-muted)"
        >
          <AppImage 
            v-if="row.mainImage" 
            :src="row.mainImage" 
            :blurhash="row.mainImageBlurhash"
            fit="cover"
            class="size-full"
            rounded="none"
          />
          <div v-else class="flex size-full items-center justify-center">
            <AppIcon name="photo" class="size-4 text-(--text-secondary)/30 stroke-[1.5]" />
          </div>
        </div>
        
        <!-- Name & Dot -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 font-bold text-(--text-main)">
            <span class="block truncate" :title="row.productName || '-'">{{ row.productName || '-' }}</span>
            <span
              v-if="row.hasNewFeedback"
              class="bg-danger size-2.5 shrink-0 animate-pulse rounded-full border-2 border-(--bg-card)"
              :title="t('order.portal.hasUpdate')"
            ></span>
          </div>
        </div>
      </div>
    </template>

    <!-- Quantity Cell -->
    <template #cell-quantity="{ value }">
      <span class="text-primary font-mono font-medium">{{ value || 1 }}</span>
    </template>

    <!-- Salesperson Cell -->
    <template #cell-salesperson="{ row }">
      <div v-if="row.salespersonName" class="flex min-w-0 flex-col">
        <span class="block truncate font-medium" :title="row.salespersonName">{{ row.salespersonName }}</span>
        <span class="block truncate text-xs text-(--text-secondary)" :title="row.store">{{ row.store }}</span>
      </div>
      <span v-else class="text-(--text-muted)">-</span>
    </template>

    <!-- Order No Cell -->
    <template #cell-orderNo="{ value }">
      <span class="block truncate font-mono text-xs text-(--text-secondary)" :title="value">{{ value }}</span>
    </template>

    <!-- Status Cell -->
    <template #cell-status="{ row }">
      <slot name="status" :order="row">
         <!-- Fallback if no slot provided -->
        <span class="inline-flex items-center rounded-full bg-(--bg-muted) px-2 py-0.5 text-xs font-medium text-(--text-secondary)">
          {{ row.status }}
        </span>
      </slot>
    </template>

    <!-- Created At Cell -->
    <template #cell-createdAt="{ value }">
      <span class="text-xs text-(--text-secondary)">{{ formatTime(value) }}</span>
    </template>

    <!-- Actions Cell -->
    <template #cell-actions="{ row }">
      <div class="flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          class="hover:text-info hover:bg-(--color-info-bg) rounded-lg p-1.5 text-(--text-secondary) transition-colors active:scale-90"
          :title="t('common.view')"
          @click.stop="$emit('detail', row)"
        >
          <AppIcon name="eye" class="size-4" />
        </button>
        <button
          class="hover:text-primary hover:bg-(--bg-hover) rounded-lg p-1.5 text-(--text-secondary) transition-colors active:scale-90"
          :title="t('common.edit')"
          @click.stop="$emit('edit', row)"
        >
          <AppIcon name="pencil-alt" class="size-4" />
        </button>
        <button
          v-if="row.status !== 'void'"
          class="hover:bg-danger/10 hover:text-danger rounded-lg p-1.5 text-(--text-secondary) transition-colors active:scale-90"
          :title="t('order.actions.void')"
          @click.stop="$emit('void', row)"
        >
          <AppIcon name="no-symbol" class="size-4" />
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
import AppIcon from '@/components/ui/AppIcon.vue';
import { formatTime } from '@/utils/formatters';

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  selectable: {
    type: Boolean,
    default: false,
  },
  selectedIds: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:selectedIds', 'detail', 'edit', 'void']);

const { t } = useI18n();

const columns = computed(() => {
  const cols = [
    { key: 'product', label: t('order.form.productName'), align: 'left', width: '25%' },
    { key: 'quantity', label: t('order.form.quantity'), align: 'center', width: '10%' },
    { key: 'salesperson', label: t('salesperson.name'), align: 'center', width: '15%' },
    { key: 'orderNo', label: t('order.orderNo'), align: 'center', width: '15%' },
    { key: 'status', label: t('order.status'), align: 'center', width: '15%' },
    { key: 'createdAt', label: t('order.createdAt'), align: 'center', width: '15%' },
    { key: 'actions', label: t('common.actions'), align: 'center', width: '100px' },
  ];

  if (props.selectable) {
    cols.unshift({ key: 'selection', label: '', align: 'center', width: '48px', class: 'px-0' });
  }

  return cols;
});

const isAllSelected = computed(() => {
  return props.data.length > 0 && props.selectedIds.length === props.data.length;
});

const isPartialSelected = computed(() => {
  return props.selectedIds.length > 0 && props.selectedIds.length < props.data.length;
});

const toggleSelectAll = (e) => {
  if (e.target.checked) {
    emit('update:selectedIds', props.data.map(order => order.id));
  } else {
    emit('update:selectedIds', []);
  }
};

const isSelected = (id) => props.selectedIds.includes(id);

const toggleSelect = (id) => {
  const newSelected = [...props.selectedIds];
  const index = newSelected.indexOf(id);
  if (index === -1) {
    newSelected.push(id);
  } else {
    newSelected.splice(index, 1);
  }
  emit('update:selectedIds', newSelected);
};
</script>
