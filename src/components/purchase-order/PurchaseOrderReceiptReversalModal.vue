<template>
  <OverlayScaffold
    :model-value="show && !!activeReceiptForReversal"
    size="lg"
    :eyebrow="'Receipt Reversal'"
    :title="t('purchaseOrder.action.reverseReceipt')"
    :description="t('purchaseOrder.ui.reversalModalHint')"
    @update:model-value="handleVisibilityChange"
    @close="$emit('close')"
  >
    <div
      v-if="activeReceiptForReversal"
      data-testid="purchase-order-reversal-modal"
      class="space-y-4"
    >
      <AppCard class="p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-medium text-(--text-main)">
            {{ activeReceiptForReversal.product_name || '-' }}
          </span>
          <code
            class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-xs text-(--text-secondary)"
          >
            {{
              activeReceiptForReversal.variant_sku || activeReceiptForReversal.product_sku || '-'
            }}
          </code>
        </div>
        <p class="mt-2 text-xs text-(--text-secondary)">
          {{ t('purchaseOrder.form.receivedQty') }}
          {{ formatInteger(activeReceiptForReversal.received_qty) }} ·
          {{ formatDateTime(activeReceiptForReversal.received_at) }}
        </p>
      </AppCard>

      <AppCard class="p-4">
        <label class="text-xs font-medium text-(--text-secondary)">
          {{ t('purchaseOrder.form.reason') }}
        </label>
        <AppInput
          :model-value="reason"
          type="text"
          class="mt-2"
          :placeholder="t('purchaseOrder.ui.reversalReasonPlaceholder')"
          @update:model-value="$emit('update:reason', $event)"
        />
      </AppCard>
    </div>

    <template #footer>
      <ActionBar class="!justify-end">
        <AppButton variant="secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton
          variant="danger"
          :loading="receiptReversalSubmitting"
          :loading-text="t('purchaseOrder.ui.reversalSubmitting')"
          @click="$emit('submit')"
        >
          {{ t('purchaseOrder.action.reverseReceipt') }}
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

const emit = defineEmits(['close', 'submit', 'update:reason']);

const handleVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close');
  }
};
</script>
