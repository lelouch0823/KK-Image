<template>
  <AppTable
    :columns="columns"
    :data="data"
    :loading="loading"
    row-key="id"
    class="h-full"
    @row-click="$emit('detail', $event)"
  >
    <!-- Custom Header for Selection -->
    <template #header-selection>
      <div class="flex items-center justify-center">
        <input
          type="checkbox"
          :checked="isAllSelected"
          :indeterminate="isPartialSelected"
          class="size-4 cursor-pointer rounded-lg border-(--border-color) bg-(--bg-muted) text-primary transition-all focus:ring-primary/20"
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
          class="size-4 cursor-pointer rounded-lg border-(--border-color) bg-(--bg-muted) text-primary transition-all focus:ring-primary/20"
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
            <svg
              class="size-4 text-(--text-secondary)/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
        </div>
        
        <!-- Name & Dot -->
        <div>
          <div class="flex items-center gap-2 font-bold text-(--text-main)">
            {{ row.productName || '-' }}
            <span
              v-if="row.hasNewFeedback"
              class="size-2.5 animate-pulse rounded-full border-2 border-(--bg-card) bg-danger"
              :title="t('order.portal.hasUpdate')"
            ></span>
          </div>
        </div>
      </div>
    </template>

    <!-- Quantity Cell -->
    <template #cell-quantity="{ value }">
      <span class="font-mono font-medium text-primary">x {{ value || 1 }}</span>
    </template>

    <!-- Salesperson Cell -->
    <template #cell-salesperson="{ row }">
      <div v-if="row.salespersonName" class="flex flex-col">
        <span class="font-medium">{{ row.salespersonName }}</span>
        <span class="text-xs text-(--text-secondary)">{{ row.store }}</span>
      </div>
      <span v-else class="text-(--text-muted)">-</span>
    </template>

    <!-- Order No Cell -->
    <template #cell-orderNo="{ value }">
      <span class="font-mono text-xs text-(--text-secondary)">{{ value }}</span>
    </template>

    <!-- Status Cell -->
    <template #cell-status="{ row }">
      <slot name="status" :order="row">
         <!-- Fallback if no slot provided -->
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-(--bg-muted) text-(--text-secondary)">
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
          class="rounded-lg p-1.5 text-(--text-secondary) transition-colors hover:bg-(--color-info-bg) hover:text-info active:scale-90"
          :title="t('common.detail')"
          @click.stop="$emit('detail', row)"
        >
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button
          class="rounded-lg p-1.5 text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-primary active:scale-90"
          :title="t('common.edit')"
          @click.stop="$emit('edit', row)"
        >
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          v-if="row.status !== 'void'"
          class="rounded-lg p-1.5 text-(--text-secondary) transition-colors hover:bg-danger/10 hover:text-danger active:scale-90"
          :title="t('order.action.void')"
          @click.stop="$emit('void', row)"
        >
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
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
import AppImage from '@/components/ui/AppImage.vue';
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
