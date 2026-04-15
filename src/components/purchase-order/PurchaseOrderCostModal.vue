<template>
  <div
    v-if="show"
    data-testid="purchase-order-cost-modal"
    class="fixed inset-0 z-[62] flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    <div
      class="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-[1.8rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
      style="max-height: calc(100vh - 3rem)"
    >
      <div
        class="relative flex items-start justify-between border-b border-(--border-color) bg-linear-to-r from-amber-50/75 via-(--bg-card) to-sky-50/35 px-6 py-5"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_24%)]"
        ></div>
        <div class="relative">
          <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
            Settlement Config
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ t('purchaseOrder.action.settle', '填写实际费用') }}
          </h2>
          <p class="mt-1 text-sm text-(--text-secondary)">
            {{
              t(
                'purchaseOrder.ui.costModalHint',
                '同步币种、分摊方式、预估费用与实际费用，必要时立即重算每条采购明细的落地成本。'
              )
            }}
          </p>
        </div>
        <button
          type="button"
          class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)"
          @click="$emit('close')"
        >
          <AppIcon name="x-mark" class="size-5" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4">
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
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4">
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
            </div>
            <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4">
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
            </div>
          </div>
          <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4">
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
          </div>
          <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4">
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
          </div>
          <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4">
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
          </div>
          <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4">
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
          </div>
        </div>
      </div>

      <div
        class="flex flex-col gap-3 border-t border-(--border-color) bg-linear-to-r from-(--bg-card) to-(--bg-muted)/30 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <p class="text-sm text-(--text-secondary)">
          {{
            t(
              'purchaseOrder.ui.costModalFooterHint',
              '保存配置后可选择立即重算分摊，当前明细的运费/关税将按新的规则刷新。'
            )
          }}
        </p>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
            @click="$emit('close')"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="costSubmitting"
            class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-(--border-color) px-4 py-2.5 text-sm font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
            @click="$emit('save')"
          >
            {{ costSubmitting ? t('purchaseOrder.ui.costSaving', '保存中...') : t('common.save', '保存') }}
          </button>
          <button
            v-if="canAllocateCurrentPurchaseOrder"
            type="button"
            :disabled="costSubmitting"
            class="bg-primary flex cursor-pointer items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            @click="$emit('allocate')"
          >
            <AppIcon name="calculator" class="size-4" />
            {{
              costSubmitting
                ? t('purchaseOrder.ui.costAllocating', '处理中...')
                : t('purchaseOrder.action.allocate', '执行成本分摊')
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
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

const updateCostDraft = (field, value) => {
  emit('update:cost-draft', { [field]: value });
};
</script>
