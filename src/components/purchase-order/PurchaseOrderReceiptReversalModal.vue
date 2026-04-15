<template>
  <div
    v-if="show && activeReceiptForReversal"
    data-testid="purchase-order-reversal-modal"
    class="fixed inset-0 z-[65] flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    <div
      class="relative w-full max-w-lg overflow-hidden rounded-[1.8rem] border border-amber-300/50 bg-(--color-modal-bg) shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]"
    >
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_30%)]"></div>
      <div class="relative border-b border-(--border-color) px-6 py-5">
        <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
          Receipt Reversal
        </p>
        <h2 class="mt-1 text-xl font-bold text-(--text-main)">
          {{ t('purchaseOrder.action.reverseReceipt', '冲销收货') }}
        </h2>
        <p class="mt-1 text-sm text-(--text-secondary)">
          {{
            t(
              'purchaseOrder.ui.reversalModalHint',
              '当前接口会整笔回滚该次收货记录，请确认库存和订单投影都允许撤回。'
            )
          }}
        </p>
      </div>

      <div class="relative space-y-4 px-6 py-5">
        <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-page)/80 p-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-(--text-main)">
              {{ activeReceiptForReversal.product_name || '—' }}
            </span>
            <code
              class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[10px] text-(--text-secondary)"
            >
              {{
                activeReceiptForReversal.variant_sku ||
                activeReceiptForReversal.product_sku ||
                '—'
              }}
            </code>
          </div>
          <p class="mt-2 text-xs text-(--text-secondary)">
            {{ t('purchaseOrder.form.receivedQty', '本次到货') }}
            {{ formatInteger(activeReceiptForReversal.received_qty) }} ·
            {{ formatDateTime(activeReceiptForReversal.received_at) }}
          </p>
        </div>

        <div class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-page)/80 p-4">
          <label class="text-[11px] font-medium text-(--text-secondary)">
            {{ t('purchaseOrder.form.reason', '原因') }}
          </label>
          <AppInput
            :model-value="reason"
            type="text"
            class="mt-2"
            :placeholder="t('purchaseOrder.ui.reversalReasonPlaceholder', '例如：误登记、异常入库、库存校正')"
            @update:model-value="$emit('update:reason', $event)"
          />
        </div>
      </div>

      <div class="relative flex justify-end gap-3 border-t border-(--border-color) px-6 py-4">
        <button
          type="button"
          class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
          @click="$emit('close')"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          :disabled="receiptReversalSubmitting"
          class="cursor-pointer rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          @click="$emit('submit')"
        >
          {{
            receiptReversalSubmitting
              ? t('purchaseOrder.ui.reversalSubmitting', '提交中...')
              : t('purchaseOrder.action.reverseReceipt', '冲销收货')
          }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppInput from '@/components/ui/AppInput.vue';

defineProps({
  show: { type: Boolean, default: false },
  t: { type: Function, required: true },
  activeReceiptForReversal: { type: Object, default: null },
  reason: { type: String, default: '' },
  receiptReversalSubmitting: { type: Boolean, default: false },
  formatInteger: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
});

defineEmits(['close', 'submit', 'update:reason']);
</script>
