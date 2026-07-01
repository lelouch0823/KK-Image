<template>
  <AppTable
    :columns="columns"
    :data="data"
    :loading="loading"
    row-key="id"
    class="h-full"
    no-border
    :virtual="data.length > 50"
    :estimate-size="64"
    :sticky-first-column="true"
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
        <AppCheckbox
          :checked="isAllSelected"
          :indeterminate="isPartialSelected"
          @change="toggleSelectAll"
        />
      </div>
    </template>

    <!-- Selection Cell -->
    <template #cell-selection="{ row }">
      <div class="flex items-center justify-center" @click.stop>
        <AppCheckbox :checked="isSelected(row.id)" @change="toggleSelect(row.id)" />
      </div>
    </template>

    <!-- Product Info Cell -->
    <template #cell-product="{ row }">
      <div class="flex items-center gap-3">
        <!-- Thumbnail -->
        <div
          class="size-10 shrink-0 overflow-hidden rounded border border-(--border-color) bg-(--bg-muted)"
        >
          <AppImage
            v-if="row.mainImage"
            :src="row.mainImage"
            :alt="row.productName || t('order.productImage', '商品图片')"
            :blurhash="row.mainImageBlurhash"
            fit="cover"
            class="size-full"
            rounded="none"
          />
          <div v-else class="flex size-full items-center justify-center">
            <AppIcon name="photo" class="size-4 stroke-[1.5] text-(--text-secondary)/30" />
          </div>
        </div>

        <!-- Name & Dot -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 font-bold text-(--text-main)">
            <span class="block truncate" :title="row.productName || '-'">{{
              row.productName || '-'
            }}</span>
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
      <AppTableTextStack
        v-if="row.salespersonName"
        :primary="row.salespersonName"
        :secondary="row.store"
      />
      <span v-else class="text-(--text-muted)">-</span>
    </template>

    <!-- Order No Cell -->
    <template #cell-orderNo="{ value }">
      <span class="block truncate font-mono text-xs text-(--text-secondary)" :title="value">{{
        value
      }}</span>
    </template>

    <!-- Status Cell -->
    <template #cell-status="{ row }">
      <slot name="status" :order="row">
        <!-- Fallback if no slot provided -->
        <AppTableStatusPill :label="row.status" variant="default" size="xs" />
      </slot>
    </template>

    <!-- Created At Cell -->
    <template #cell-createdAt="{ value }">
      <span class="text-xs text-(--text-secondary)">{{ formatTime(value) }}</span>
    </template>

    <!-- Actions Cell -->
    <template #cell-actions="{ row }">
      <div
        class="flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <AppButton
          variant="ghost"
          size="sm"
          class="text-(--text-secondary) hover:text-info hover:bg-info-bg !h-7 !w-7 !gap-0 !px-0 [&_span]:hidden"
          :title="t('common.view')"
          @click.stop="$emit('detail', row)"
        >
          <template #icon-left>
            <AppIcon name="eye" class="size-4" />
          </template>
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          class="text-(--text-secondary) hover:text-primary hover:bg-(--bg-hover) !h-7 !w-7 !gap-0 !px-0 [&_span]:hidden"
          :title="t('common.edit')"
          @click.stop="$emit('edit', row)"
        >
          <template #icon-left>
            <AppIcon name="pencil-alt" class="size-4" />
          </template>
        </AppButton>
        <AppButton
          v-if="row.status !== 'void'"
          variant="ghost"
          size="sm"
          class="text-(--text-secondary) hover:bg-danger/10 hover:text-danger !h-7 !w-7 !gap-0 !px-0 [&_span]:hidden"
          :title="t('order.actions.void')"
          @click.stop="$emit('void', row)"
        >
          <template #icon-left>
            <AppIcon name="no-symbol" class="size-4" />
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
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppTableTextStack from '@/components/ui/AppTableTextStack.vue';
import AppTableStatusPill from '@/components/ui/AppTableStatusPill.vue';
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
    {
      key: 'quantity',
      label: t('order.form.quantity'),
      kind: 'numeric',
      align: 'center',
      width: '10%',
    },
    { key: 'salesperson', label: t('salesperson.name'), align: 'center', width: '15%' },
    { key: 'orderNo', label: t('order.orderNo'), align: 'center', width: '15%' },
    {
      key: 'status',
      label: t('order.status'),
      kind: 'status',
      align: 'left',
      width: '1%',
      minWidth: '7.5rem',
      maxWidth: '9rem',
    },
    {
      key: 'createdAt',
      label: t('order.createdAt'),
      kind: 'datetime',
      align: 'center',
      width: '15%',
    },
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

const toggleSelectAll = (checked) => {
  if (checked) {
    emit(
      'update:selectedIds',
      props.data.map((order) => order.id)
    );
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
