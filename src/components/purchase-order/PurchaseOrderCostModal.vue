<template>
  <OverlayScaffold
    :model-value="show"
    size="3xl"
    :eyebrow="'Settlement Config'"
    :title="t('purchaseOrder.action.settle', '填写实际费用')"
    :description="
      t(
        'purchaseOrder.ui.costModalHint',
        '同步币种、分摊方式、预估费用与实际费用，必要时立即重算每条采购明细的落地成本。'
      )
    "
    @update:model-value="handleVisibilityChange"
    @close="$emit('close')"
  >
    <template #headerActions>
      <AppButton variant="ghost" size="sm" class="h-9 w-9 px-0" @click="$emit('close')">
        <AppIcon name="x-mark" class="size-5" />
      </AppButton>
    </template>

    <div data-testid="purchase-order-cost-modal" class="grid gap-4 md:grid-cols-2">
      <AppCard class="p-4">
        <label class="text-xs font-medium text-(--text-secondary)">
          {{ t('purchaseOrder.form.remark') }}
        </label>
        <AppInput
          :model-value="costDraft.remark"
          type="text"
          class="mt-2"
          :placeholder="t('purchaseOrder.form.remarkPlaceholder')"
          @update:model-value="updateCostDraft('remark', $event)"
        />
      </AppCard>
      <div class="grid gap-4 sm:grid-cols-2">
        <AppCard class="p-4">
          <label class="text-xs font-medium text-(--text-secondary)">
            {{ t('purchaseOrder.form.currency') }}
          </label>
          <AppSelect
            :model-value="costDraft.currency"
            :options="currencyOptions"
            :placeholder="t('purchaseOrder.form.currency')"
            size="sm"
            class="mt-2"
            @update:model-value="updateCostDraft('currency', $event)"
          />
        </AppCard>
        <AppCard class="p-4">
          <label class="text-xs font-medium text-(--text-secondary)">
            {{ t('purchaseOrder.form.allocationMethod') }}
          </label>
          <AppSelect
            :model-value="costDraft.allocation_method"
            :options="allocationMethodOptions"
            :placeholder="t('purchaseOrder.form.byQuantity')"
            size="sm"
            class="mt-2"
            @update:model-value="updateCostDraft('allocation_method', $event)"
          />
        </AppCard>
      </div>
      <AppCard class="p-4">
        <label class="text-xs font-medium text-(--text-secondary)">
          {{ t('purchaseOrder.form.estimatedShipping') }}
        </label>
        <AppInput
          :model-value="costDraft.estimated_shipping_cost"
          type="number"
          step="0.01"
          class="mt-2"
          @update:model-value="updateCostDraft('estimated_shipping_cost', $event)"
        />
      </AppCard>
      <AppCard class="p-4">
        <label class="text-xs font-medium text-(--text-secondary)">
          {{ t('purchaseOrder.form.estimatedTariff') }}
        </label>
        <AppInput
          :model-value="costDraft.estimated_tariff_cost"
          type="number"
          step="0.01"
          class="mt-2"
          @update:model-value="updateCostDraft('estimated_tariff_cost', $event)"
        />
      </AppCard>
      <AppCard class="p-4">
        <label class="text-xs font-medium text-(--text-secondary)">
          {{ t('purchaseOrder.form.actualShipping') }}
        </label>
        <AppInput
          :model-value="costDraft.actual_shipping_cost"
          type="number"
          step="0.01"
          class="mt-2"
          @update:model-value="updateCostDraft('actual_shipping_cost', $event)"
        />
      </AppCard>
      <AppCard class="p-4">
        <label class="text-xs font-medium text-(--text-secondary)">
          {{ t('purchaseOrder.form.actualTariff') }}
        </label>
        <AppInput
          :model-value="costDraft.actual_tariff_cost"
          type="number"
          step="0.01"
          class="mt-2"
          @update:model-value="updateCostDraft('actual_tariff_cost', $event)"
        />
      </AppCard>
    </div>

    <template #footer>
      <ActionBar>
        <template #leading>
          <p class="text-sm text-(--text-secondary)">
            {{
              t(
                'purchaseOrder.ui.costModalFooterHint',
                '保存配置后可选择立即重算分摊，当前明细的运费/关税将按新的规则刷新。'
              )
            }}
          </p>
        </template>
        <AppButton variant="secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton
          variant="outline"
          :loading="costSubmitting"
          :loading-text="t('purchaseOrder.ui.costSaving', '保存中...')"
          @click="$emit('save')"
        >
          {{ t('common.save', '保存') }}
        </AppButton>
        <AppButton
          v-if="canAllocateCurrentPurchaseOrder"
          :loading="costSubmitting"
          :loading-text="t('purchaseOrder.ui.costAllocating', '处理中...')"
          @click="$emit('allocate')"
        >
          <template #icon-left>
            <AppIcon name="calculator" class="size-4" />
          </template>
          {{ t('purchaseOrder.action.allocate', '执行成本分摊') }}
        </AppButton>
      </ActionBar>
    </template>
  </OverlayScaffold>
</template>

<script setup>
import OverlayScaffold from '@/design-system/composed/OverlayScaffold.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/Select.vue';

defineProps({
  show: { type: Boolean, default: false },
  t: { type: Function, required: true },
  costDraft: { type: Object, required: true },
  currencyOptions: { type: Array, default: () => [] },
  allocationMethodOptions: { type: Array, default: () => [] },
  costSubmitting: { type: Boolean, default: false },
  canAllocateCurrentPurchaseOrder: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'save', 'allocate', 'update:cost-draft']);

const handleVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close');
  }
};

const updateCostDraft = (field, value) => {
  emit('update:cost-draft', { [field]: value });
};
</script>
