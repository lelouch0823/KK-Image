<template>
  <div class="overflow-x-auto rounded-2xl border border-(--border-color)/70 bg-(--bg-card)">
    <AppTable
      :columns="columns"
      :data="tableRows"
      no-border
      row-key="__rowKey"
      table-layout="fixed"
    >
      <template #cell-variant="{ row, index }">
        <div
          :data-testid="`variant-row-${index}`"
          :data-variant-state="row.status || 'active'"
          class="min-w-[14rem]"
        >
          <div class="flex items-center gap-2">
            <span
              class="inline-flex h-6 max-w-[18rem] items-center truncate rounded-md bg-(--bg-muted) px-2 text-xs font-semibold text-(--text-secondary)"
              :title="formatVariantName(row.options_values)"
            >
              {{ formatVariantName(row.options_values) }}
            </span>
            <AppIcon
              v-if="row.status === 'pending_incomplete'"
              name="exclamation-triangle"
              class="text-warning size-4"
            />
          </div>
          <p v-if="row.status === 'pending_incomplete'" class="text-warning-text mt-1 text-xs">
            {{
              t(
                'product.form.incomplete_variant_hint',
                'This legacy variant no longer matches the current spec structure.'
              )
            }}
          </p>
        </div>
      </template>

      <template #cell-sku="{ row, index }">
        <AppInput
          :data-testid="`variant-sku-${index}`"
          :model-value="row.sku || ''"
          placeholder="SKU"
          size="sm"
          @update:model-value="(value) => updateVariantField(index, 'sku', value)"
        />
      </template>

      <template #cell-barcode="{ row, index }">
        <AppInput
          :data-testid="`variant-barcode-${index}`"
          :model-value="row.barcode || ''"
          placeholder="Barcode"
          size="sm"
          @update:model-value="(value) => updateVariantField(index, 'barcode', value)"
        />
      </template>

      <template #cell-supplierSku="{ row, index }">
        <AppInput
          :data-testid="`variant-supplier-sku-${index}`"
          :model-value="row.supplier_sku || ''"
          placeholder="Supplier SKU"
          size="sm"
          @update:model-value="(value) => updateVariantField(index, 'supplier_sku', value)"
        />
      </template>

      <template #cell-price="{ row, index }">
        <AppInput
          :data-testid="`variant-price-${index}`"
          :model-value="row.price ?? ''"
          type="number"
          step="0.01"
          placeholder="0.00"
          size="sm"
          @update:model-value="
            (value) => updateVariantField(index, 'price', parseNumberInput(value))
          "
        >
          <template #prepend>
            <span class="text-xs text-(--text-muted)">{{ currencySymbol }}</span>
          </template>
        </AppInput>
      </template>

      <template #cell-cost="{ row, index }">
        <AppInput
          :data-testid="`variant-cost-${index}`"
          :model-value="row.cost_price ?? ''"
          type="number"
          step="0.01"
          placeholder="0.00"
          size="sm"
          @update:model-value="
            (value) => updateVariantField(index, 'cost_price', parseNumberInput(value))
          "
        >
          <template #prepend>
            <span class="text-xs text-(--text-muted)">{{ currencySymbol }}</span>
          </template>
        </AppInput>
      </template>

      <template #cell-stock="{ row, index }">
        <AppInput
          :data-testid="`variant-stock-${index}`"
          :model-value="row.stock_quantity ?? ''"
          type="number"
          placeholder="0"
          size="sm"
          :readonly="isStockReadonly(row)"
          @update:model-value="
            (value) => updateVariantField(index, 'stock_quantity', parseNumberInput(value))
          "
        />
      </template>

      <template #cell-alert="{ row, index }">
        <AppInput
          :data-testid="`variant-alert-${index}`"
          :model-value="row.alert_threshold ?? ''"
          type="number"
          placeholder="10"
          size="sm"
          @update:model-value="
            (value) => updateVariantField(index, 'alert_threshold', parseNumberInput(value))
          "
        />
      </template>

      <template #cell-status="{ row, index }">
        <StatusBadge
          v-if="row.status === 'pending_incomplete'"
          variant="warning"
          :label="t('product.table.variant.pending', 'Pending')"
        />
        <AppButton
          v-else
          variant="ghost"
          size="sm"
          class="!h-8 !px-2 whitespace-nowrap"
          :title="
            row.status === 'archived'
              ? t('common.archived', 'Archived')
              : t('common.active', 'Active')
          "
          @click="
            updateVariantField(index, 'status', row.status === 'archived' ? 'active' : 'archived')
          "
        >
          <template #icon-left>
            <AppIcon
              :name="row.status === 'archived' ? 'minus-circle-solid' : 'check-circle-solid'"
              :class="
                row.status === 'archived' ? 'size-4 text-(--text-muted)' : 'size-4 text-success'
              "
            />
          </template>
          {{
            row.status === 'archived'
              ? t('common.archived', 'Archived')
              : t('common.active', 'Active')
          }}
        </AppButton>
      </template>

      <template #cell-images="{ row }">
        <StatusBadge variant="default" :label="String(row.images?.length || 0)" />
      </template>

      <template #cell-actions="{ index }">
        <AppButton
          :data-testid="`delete-variant-${index}`"
          variant="ghost"
          size="sm"
          class="!h-8 !w-8 !px-0 text-danger hover:!bg-danger/10 hover:!text-danger"
          :title="t('common.delete', 'Delete')"
          @click="removeVariant(indexSafe(index))"
        >
          <AppIcon name="trash" class="size-4" />
        </AppButton>
      </template>
    </AppTable>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  inventoryReadonly: {
    type: Boolean,
    default: false,
  },
  currencySymbol: {
    type: String,
    default: '¥',
  },
});

const emit = defineEmits(['update:modelValue']);

const columns = computed(() => [
  {
    key: 'variant',
    label: t('product.table.variant.variant_name', 'Variant'),
    align: 'left',
    width: '240px',
    minWidth: '240px',
  },
  { key: 'sku', label: t('product.table.variant.sku', 'SKU'), width: '160px', minWidth: '160px' },
  {
    key: 'barcode',
    label: t('product.table.variant.barcode', 'Barcode'),
    width: '160px',
    minWidth: '160px',
  },
  {
    key: 'supplierSku',
    label: t('product.table.variant.supplier_sku', 'Supplier SKU'),
    width: '170px',
    minWidth: '170px',
  },
  { key: 'price', label: t('product.table.variant.price', 'Price'), width: '120px' },
  { key: 'cost', label: t('product.table.variant.cost', 'Cost'), width: '120px' },
  { key: 'stock', label: t('product.table.variant.stock', 'Stock'), width: '110px' },
  { key: 'alert', label: t('product.table.variant.alert', 'Alert'), width: '110px' },
  { key: 'status', label: t('product.table.variant.status', 'Status'), width: '130px' },
  { key: 'images', label: t('product.table.variant.images', 'Images'), width: '90px' },
  { key: 'actions', label: t('common.actions', 'Actions'), width: '88px' },
]);

const getVariants = () => (Array.isArray(props.modelValue) ? props.modelValue : []);

const tableRows = computed(() =>
  getVariants().map((variant, index) => ({
    ...variant,
    __rowKey: variant.id || variant._clientKey || `variant-${index}`,
  }))
);

const isStockReadonly = (variant) => Boolean(props.inventoryReadonly && variant?.id);

const emitNextVariants = (updater) => {
  const current = getVariants();
  const next = updater(current.map((variant) => ({ ...variant })));
  emit('update:modelValue', next);
};

const updateVariantField = (index, field, value) => {
  emitNextVariants((list) => {
    if (!list[index]) return list;
    list[index][field] = value;
    return list;
  });
};

const removeVariant = (index) => {
  emitNextVariants((list) => list.filter((_, itemIndex) => itemIndex !== index));
};

const indexSafe = (index) => Number(index);

const parseNumberInput = (rawValue) => {
  if (rawValue === '') return '';
  const numberValue = Number(rawValue);
  return Number.isFinite(numberValue) ? numberValue : rawValue;
};

const formatVariantName = (optionsValues) => {
  if (!optionsValues || Object.keys(optionsValues).length === 0) return 'Default';
  const keys = Object.keys(optionsValues).sort();
  return keys.map((key) => optionsValues[key]).join(' · ');
};
</script>
