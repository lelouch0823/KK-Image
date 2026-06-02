<template>
  <Modal
    :model-value="show"
    size="6xl"
    :closable="false"
    body-class="!p-0"
    @update:model-value="handleModalVisibilityChange"
  >
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
            Draft Builder
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ t('purchaseOrder.action.create') }}
          </h2>
          <p class="mt-1 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.ui.createHint', '先设置成本策略，再补充采购商品和关联预定单。') }}
          </p>
        </div>
        <AppButton variant="ghost" size="sm" class="h-9 w-9 px-0" @click="$emit('close')">
          <AppIcon name="x-mark" class="size-5" />
        </AppButton>
      </div>
    </template>

    <div data-testid="purchase-order-create-shell" class="space-y-5 px-6 py-4">
      <StatePanel>
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
              Configuration
            </p>
            <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
              {{ t('purchaseOrder.ui.configurationTitle', '采购策略与费用设置') }}
            </h3>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge variant="info">
              {{ t('purchaseOrder.detail.items') }} {{ poItems.length }}
            </StatusBadge>
            <StatusBadge variant="success">
              {{ t('purchaseOrder.form.totalQty') }} {{ totalCreateQty }}
            </StatusBadge>
            <StatusBadge v-if="shortageItems.length > 0" variant="warning">
              {{ t('purchaseOrder.form.quantityWarning') }} {{ shortageItems.length }}
            </StatusBadge>
          </div>
        </div>

        <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,1fr)]">
          <StatePanel
            variant="plain"
            class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4"
          >
            <label class="text-xs font-medium text-(--text-secondary)">
              {{ t('purchaseOrder.form.remark') }}
            </label>
            <AppInput
              data-testid="purchase-order-create-remark"
              :model-value="createForm.remark"
              type="text"
              class="mt-2"
              :placeholder="t('purchaseOrder.form.remarkPlaceholder')"
              @update:model-value="updateCreateField('remark', $event)"
            />
          </StatePanel>

          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatePanel
              variant="plain"
              class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4"
            >
              <label class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.form.currency') }}
              </label>
              <AppSelect
                :model-value="createForm.currency"
                :options="currencyOptions"
                :placeholder="t('purchaseOrder.form.currency')"
                size="sm"
                class="mt-2"
                @update:model-value="updateCreateField('currency', $event)"
              />
            </StatePanel>
            <StatePanel
              variant="plain"
              class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4"
            >
              <label class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.form.estimatedShipping') }}
              </label>
              <AppInput
                :model-value="createForm.estimated_shipping_cost"
                type="number"
                step="0.01"
                class="mt-2"
                @update:model-value="updateCreateField('estimated_shipping_cost', $event)"
              />
            </StatePanel>
            <StatePanel
              variant="plain"
              class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4"
            >
              <label class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.form.estimatedTariff') }}
              </label>
              <AppInput
                :model-value="createForm.estimated_tariff_cost"
                type="number"
                step="0.01"
                class="mt-2"
                @update:model-value="updateCreateField('estimated_tariff_cost', $event)"
              />
            </StatePanel>
            <StatePanel
              variant="plain"
              class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4 sm:col-span-2 xl:col-span-3"
            >
              <label class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.form.allocationMethod') }}
              </label>
              <AppSelect
                :model-value="createForm.allocation_method"
                :options="allocationMethodOptions"
                :placeholder="t('purchaseOrder.form.byQuantity')"
                size="sm"
                class="mt-2"
                @update:model-value="updateCreateField('allocation_method', $event)"
              />
            </StatePanel>
          </div>
        </div>
      </StatePanel>

      <StatePanel>
        <ActionBar class="mb-4 border-none bg-transparent px-0 py-0 shadow-none">
          <template #leading>
            <div>
              <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
                Procurement Mix
              </p>
              <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
                {{ t('purchaseOrder.form.itemList', '采购商品') }}
                <span
                  v-if="poItems.length > 0"
                  class="ml-1 font-mono text-xs font-normal tabular-nums text-(--text-secondary)"
                >
                  ({{ poItems.length }})
                </span>
              </h3>
            </div>
          </template>
          <AppButton variant="outline" size="sm" @click="$emit('open-order-picker', 'create')">
            <template #icon-left>
              <AppIcon name="clipboard-document-list" class="size-3.5" />
            </template>
            {{ t('purchaseOrder.action.linkOrders') }}
          </AppButton>
          <AppButton
            data-testid="purchase-order-open-product-picker-create"
            variant="white"
            size="sm"
            @click="$emit('open-product-picker', 'create')"
          >
            <template #icon-left>
              <AppIcon name="plus" class="size-3.5" />
            </template>
            {{ t('purchaseOrder.action.addProduct') }}
          </AppButton>
        </ActionBar>

        <StatePanel
          v-if="poItems.length === 0"
          variant="plain"
          class="flex flex-col items-center py-12"
        >
          <div class="flex size-16 items-center justify-center rounded-2xl bg-(--bg-muted)">
            <AppIcon name="cube" class="size-7 text-(--text-muted)" />
          </div>
          <p class="mt-3 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.form.noItems') }}
          </p>
        </StatePanel>

        <AppTable v-else :columns="itemColumns" :data="poItems" no-border table-layout="fixed">
          <template #cell-product="{ row }">
            <div class="flex items-center gap-2.5">
              <div
                class="size-8 shrink-0 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-muted)"
              >
                <AppImage v-if="row.image" :src="getFileUrl(row.image)" :alt="row.name" class="size-full" />
                <div v-else class="flex size-full items-center justify-center text-(--text-muted)">
                  <AppIcon name="photo" class="size-4" />
                </div>
              </div>
              <div class="min-w-0">
                <div
                  class="truncate text-sm font-medium text-(--text-main)"
                  :title="row.product_name || '—'"
                >
                  {{ row.product_name || '—' }}
                </div>
                <div class="flex min-w-0 items-center gap-1.5 text-xs text-(--text-secondary)">
                  <span class="max-w-[8rem] truncate font-mono" :title="row.sku || '-'">
                    {{ row.sku || '-' }}
                  </span>
                  <span v-if="row.brand" class="max-w-[7rem] truncate" :title="row.brand">
                    · {{ row.brand }}
                  </span>
                </div>
              </div>
            </div>
          </template>
          <template #cell-quantity="{ row }">
            <div class="flex flex-col items-center">
              <AppInput
                v-model="row.quantity"
                type="number"
                min="1"
                class="w-20 text-center"
                size="sm"
              />
              <span
                v-if="row.required_quantity && row.quantity < row.required_quantity"
                class="mt-1 text-xs font-medium text-danger"
              >
                {{ t('purchaseOrder.form.quantityWarning') }} ({{ row.required_quantity }})
              </span>
            </div>
          </template>
          <template #cell-unitCost="{ row }">
            <div class="flex justify-end">
              <AppInput
                v-model="row.unit_cost"
                type="number"
                step="0.01"
                min="0"
                class="w-24 text-right"
                size="sm"
              />
            </div>
          </template>
          <template #cell-source="{ row }">
            <div class="flex justify-center">
              <StatusBadge :variant="row.pre_order_id ? 'info' : 'default'">
                <template v-if="row.pre_order_id">
                  {{ t('purchaseOrder.form.sourceOrder') }}
                </template>
                <template v-else>
                  {{ t('purchaseOrder.form.sourceStock') }}
                </template>
              </StatusBadge>
            </div>
          </template>
          <template #cell-actions="{ index }">
            <div class="flex justify-end">
              <AppButton
                variant="ghost"
                size="sm"
                class="h-8 w-8 px-0"
                @click="$emit('remove-item', index)"
              >
                <AppIcon name="trash" class="size-4" />
              </AppButton>
            </div>
          </template>
        </AppTable>
      </StatePanel>
    </div>

    <template #footer>
      <ActionBar>
        <template #leading>
          <div class="text-sm text-(--text-secondary)">
            <span v-if="poItems.length > 0">
              {{ poItems.length }} {{ t('purchaseOrder.form.itemsCount') }} ·
              {{ t('purchaseOrder.form.totalQty') }}:
              <strong class="font-mono font-semibold tabular-nums text-(--text-main)">
                {{ totalCreateQty }}
              </strong>
            </span>
          </div>
        </template>
        <AppButton variant="secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton
          data-testid="purchase-order-create-submit"
          :disabled="poItems.length === 0"
          @click="$emit('submit')"
        >
          {{ t('common.create', '创建') }}
        </AppButton>
      </ActionBar>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import StatePanel from '@/design-system/composed/StatePanel.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppInput from '@/components/ui/AppInput.vue';
import Modal from '@/components/ui/Modal.vue';
import AppSelect from '@/components/ui/Select.vue';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  t: { type: Function, required: true },
  createForm: { type: Object, required: true },
  currencyOptions: { type: Array, default: () => [] },
  allocationMethodOptions: { type: Array, default: () => [] },
  poItems: { type: Array, default: () => [] },
  totalCreateQty: { type: Number, default: 0 },
  shortageItems: { type: Array, default: () => [] },
  getFileUrl: { type: Function, required: true },
});

const emit = defineEmits([
  'close',
  'open-order-picker',
  'open-product-picker',
  'remove-item',
  'submit',
  'update:create-form',
]);

const handleModalVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close');
  }
};

const itemColumns = computed(() => [
  { key: 'product', label: props.t('purchaseOrder.table.product'), width: '38%' },
  {
    key: 'quantity',
    label: props.t('purchaseOrder.table.quantity'),
    width: '18%',
    headerClass: 'text-center',
    cellClass: 'text-center',
  },
  {
    key: 'unitCost',
    label: props.t('purchaseOrder.table.unitCost'),
    width: '18%',
    headerClass: 'text-right',
    cellClass: 'text-right',
  },
  {
    key: 'source',
    label: props.t('purchaseOrder.form.source'),
    width: '18%',
    headerClass: 'text-center',
    cellClass: 'text-center',
  },
  { key: 'actions', label: '', width: '8%', headerClass: 'text-right', cellClass: 'text-right' },
]);

const updateCreateField = (field, value) => {
  emit('update:create-form', { [field]: value });
};
</script>
