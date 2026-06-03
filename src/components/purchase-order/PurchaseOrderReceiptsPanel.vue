<template>
  <section
    data-testid="purchase-order-detail-receipts"
    class="rounded-[1.6rem] border border-(--border-color)/65 bg-(--bg-card) p-4 shadow-none"
  >
    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
          {{ t('purchaseOrder.detail.receipts') }}
        </p>
        <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
          {{ t('purchaseOrder.detail.receipts') }}
          <span class="ml-1 font-mono text-xs font-normal text-(--text-secondary) tabular-nums">
            ({{ receiptTimeline.length }})
          </span>
        </h3>
        <p class="mt-1 text-xs text-(--text-secondary)">
          {{
            t('purchaseOrder.ui.receiptLedgerHint')
          }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 lg:justify-end">
        <StatusBadge variant="default" class="text-xs">
          {{ t('purchaseOrder.ui.receiptLedgerMeta') }}
        </StatusBadge>
        <StatusBadge v-if="receiptReceivableCount > 0" variant="info" class="text-xs">
          {{ t('purchaseOrder.ui.receiptReceivableLines') }}
          {{ receiptReceivableCount }}
        </StatusBadge>
        <AppButton
          v-if="canRecordReceipts"
          type="button"
          variant="primary"
          size="sm"
          data-testid="purchase-order-open-receipt-modal"
          class="shadow-sm"
          @click="$emit('open-receipt-modal')"
        >
          <template #icon-left>
            <AppIcon name="archive-box-arrow-down" class="size-3.5" />
          </template>
          {{ t('purchaseOrder.action.recordReceipt') }}
        </AppButton>
        <AppButton
          v-if="canCloseShortages"
          type="button"
          variant="white"
          size="sm"
          data-testid="purchase-order-open-shortage-modal"
          class="shadow-sm"
          @click="$emit('open-shortage-modal')"
        >
          <template #icon-left>
            <AppIcon name="minus-circle" class="size-3.5" />
          </template>
          {{ t('purchaseOrder.action.closeOutstanding') }}
        </AppButton>
      </div>
    </div>

    <div v-if="receiptTimeline.length > 0" class="space-y-3">
      <article
        v-for="receipt in receiptTimeline"
        :key="receipt.id"
        data-testid="purchase-order-receipt-card"
        class="grid gap-3 rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card) p-3.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(14rem,16rem)]"
      >
        <div class="min-w-0">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <span
              class="line-clamp-1 min-w-0 text-sm font-medium break-all text-(--text-main)"
              :title="receipt.product_name"
            >
              {{ receipt.product_name || '-' }}
            </span>
            <code
              class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-xs text-(--text-secondary)"
            >
              {{ receipt.variant_sku || receipt.product_sku || '-' }}
            </code>
            <StatusBadge :variant="receipt.is_reversed ? 'default' : 'success'" class="text-xs">
              {{
                receipt.is_reversed
                  ? t('purchaseOrder.ui.receiptReversedTag')
                  : t('purchaseOrder.ui.receiptRecordedTag')
              }}
            </StatusBadge>
            <StatusBadge
              v-if="helpers.canReverseReceipt(receipt)"
              variant="warning"
              class="text-xs"
            >
              {{ t('purchaseOrder.ui.receiptReversibleTag') }}
            </StatusBadge>
          </div>
          <div class="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-(--text-secondary)">
            <span>
              {{ t('purchaseOrder.form.receivedQty') }}
              {{ helpers.formatInteger(receipt.received_qty) }}
            </span>
            <span v-if="receipt.available_reversal_qty > 0">
              · {{ t('purchaseOrder.ui.availableReversalQty') }}
              {{ helpers.formatInteger(receipt.available_reversal_qty) }}
            </span>
            <span v-if="receipt.reversed_qty > 0">
              · {{ t('purchaseOrder.ui.reversedQty') }}
              {{ helpers.formatInteger(receipt.reversed_qty) }}
            </span>
            <span>· {{ helpers.formatDateTime(receipt.received_at) }}</span>
          </div>
          <div
            v-if="receipt.variant_options && Object.keys(receipt.variant_options).length > 0"
            class="mt-2 flex min-w-0 flex-wrap gap-1"
          >
            <span
              v-for="(val, key) in receipt.variant_options"
              :key="`receipt-variant-${receipt.id}-${key}`"
              class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-xs font-medium break-all"
            >
              {{ key }}: {{ val }}
            </span>
          </div>
          <p
            v-if="receipt.note"
            class="mt-2 rounded-2xl bg-(--bg-muted)/55 px-3 py-2 text-xs leading-5 break-all whitespace-pre-wrap text-(--text-secondary)"
          >
            {{ receipt.note }}
          </p>
        </div>

        <div class="flex flex-col justify-between rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3">
          <div class="space-y-2 text-xs text-(--text-secondary)">
            <div class="flex items-center justify-between gap-3">
              <span>{{ t('purchaseOrder.ui.receiptRecordId') }}</span>
              <code class="font-mono text-xs text-(--text-main)">{{ receipt.id }}</code>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span>{{ t('purchaseOrder.ui.receiptReversalCount') }}</span>
              <span class="font-mono text-sm font-semibold text-(--text-main) tabular-nums">
                {{ helpers.formatInteger(receipt.reversal_count) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span>{{ t('purchaseOrder.ui.receiptLastReversedAt') }}</span>
              <span class="text-right text-(--text-main)">
                {{ receipt.last_reversed_at ? helpers.formatDateTime(receipt.last_reversed_at) : '-' }}
              </span>
            </div>
          </div>
          <AppButton
            v-if="helpers.canReverseReceipt(receipt)"
            type="button"
            variant="white"
            size="sm"
            data-testid="purchase-order-open-reversal-modal"
            class="mt-3 justify-center"
            @click="$emit('open-reversal-modal', receipt)"
          >
            <template #icon-left>
              <AppIcon name="arrow-uturn-left" class="size-3.5" />
            </template>
            {{ t('purchaseOrder.action.reverseReceipt') }}
          </AppButton>
        </div>
      </article>
    </div>

    <div
      v-else
      class="rounded-[1.35rem] border border-dashed border-(--border-subtle) bg-(--bg-page)/60 px-4 py-10 text-center"
    >
      <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-(--bg-muted)">
        <AppIcon name="archive-box" class="size-5 text-(--text-muted)" />
      </div>
      <p class="mt-3 text-sm font-medium text-(--text-main)">
        {{ t('purchaseOrder.ui.receiptLedgerEmptyTitle') }}
      </p>
      <p class="mt-1 text-sm text-(--text-secondary)">
        {{
          canRecordReceipts
            ? t('purchaseOrder.ui.receiptLedgerEmptyBody')
            : t('purchaseOrder.ui.receiptLedgerLockedBody')
        }}
      </p>
    </div>
  </section>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

defineProps({
  receiptTimeline: {
    type: Array,
    default: () => [],
  },
  receiptReceivableCount: {
    type: Number,
    default: 0,
  },
  canRecordReceipts: {
    type: Boolean,
    default: false,
  },
  canCloseShortages: {
    type: Boolean,
    default: false,
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

defineEmits(['open-receipt-modal', 'open-shortage-modal', 'open-reversal-modal']);
</script>
