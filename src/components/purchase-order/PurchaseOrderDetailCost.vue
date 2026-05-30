<template>
  <section
    data-testid="purchase-order-detail-cost"
    class="rounded-[1.5rem] border border-(--border-color)/65 bg-(--bg-card) p-5 shadow-none"
  >
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
          Cost Summary
        </p>
        <h3 class="text-sm font-semibold text-(--text-main)">
          {{ t('purchaseOrder.detail.costInfo') }}
        </h3>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <span
          class="rounded-full border border-(--border-color) px-2.5 py-1 text-[11px] font-medium text-(--text-secondary)"
        >
          {{ detail.currency || 'CNY' }}
        </span>
        <span
          class="rounded-full border border-(--border-color) px-2.5 py-1 text-[11px] font-medium text-(--text-secondary)"
        >
          {{
            detail.allocation_method === 'by_value'
              ? t('purchaseOrder.form.byValue')
              : t('purchaseOrder.form.byQuantity')
          }}
        </span>
        <AppButton
          variant="outline"
          size="sm"
          data-testid="purchase-order-open-cost-modal"
          class="!h-8 !bg-(--bg-card)/85 text-(--text-main)"
          @click="$emit('open-cost-modal')"
        >
          <AppIcon name="pencil-square" class="size-3.5" />
          {{ t('purchaseOrder.action.settle', '填写实际费用') }}
        </AppButton>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-2xl bg-(--bg-muted)/55 p-3">
        <div class="text-xs text-(--text-secondary)">
          {{ t('purchaseOrder.form.estimatedShipping') }}
        </div>
        <div class="mt-1 font-mono text-base font-semibold text-(--text-main) tabular-nums">
          {{ helpers.formatPurchaseCurrency(detail.estimated_shipping_cost, detail.currency) }}
        </div>
      </div>
      <div class="rounded-2xl bg-(--bg-muted)/55 p-3">
        <div class="text-xs text-(--text-secondary)">
          {{ t('purchaseOrder.form.estimatedTariff') }}
        </div>
        <div class="mt-1 font-mono text-base font-semibold text-(--text-main) tabular-nums">
          {{ helpers.formatPurchaseCurrency(detail.estimated_tariff_cost, detail.currency) }}
        </div>
      </div>
      <div class="rounded-2xl bg-(--bg-muted)/40 p-3">
        <div class="text-xs text-(--text-secondary)">
          {{ t('purchaseOrder.table.actualShipping') }}
        </div>
        <div class="mt-1 font-mono text-base font-semibold text-(--text-main) tabular-nums">
          {{ helpers.formatPurchaseCurrency(detail.actual_shipping_cost, detail.currency) }}
        </div>
      </div>
      <div class="rounded-2xl bg-(--bg-muted)/40 p-3">
        <div class="text-xs text-(--text-secondary)">
          {{ t('purchaseOrder.table.actualTariff') }}
        </div>
        <div class="mt-1 font-mono text-base font-semibold text-(--text-main) tabular-nums">
          {{ helpers.formatPurchaseCurrency(detail.actual_tariff_cost, detail.currency) }}
        </div>
      </div>
    </div>
    <p class="mt-3 text-xs leading-5 text-(--text-secondary)">
      {{
        t(
          'purchaseOrder.ui.costFallbackHint',
          '未填写实际费用时，成本分摊会回退使用预估运费与预估关税。'
        )
      }}
    </p>
  </section>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  detail: {
    type: Object,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
  helpers: {
    type: Object,
    required: true,
  },
});

defineEmits(['open-cost-modal']);
</script>
