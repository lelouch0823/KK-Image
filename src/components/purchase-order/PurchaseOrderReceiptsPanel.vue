<template>
  <section
    data-testid="purchase-order-detail-receipts"
    class="rounded-[1.6rem] border border-(--border-color)/65 bg-(--bg-card) p-4 shadow-none"
  >
    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
          Receipt Ledger
        </p>
        <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
          {{ t('purchaseOrder.detail.receipts', '收货台账') }}
          <span class="ml-1 font-mono text-xs font-normal text-(--text-secondary) tabular-nums">
            ({{ receiptTimeline.length }})
          </span>
        </h3>
        <p class="mt-1 text-xs text-(--text-secondary)">
          {{
            t(
              'purchaseOrder.ui.receiptLedgerHint',
              '登记每次到货与冲销记录，确保采购、订单、库存三条投影保持一致。'
            )
          }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 lg:justify-end">
        <StatusBadge variant="default" class="text-[10px]">
          {{ t('purchaseOrder.ui.receiptLedgerMeta', '支持部分到货与整笔冲销') }}
        </StatusBadge>
        <StatusBadge v-if="receiptReceivableCount > 0" variant="info" class="text-[10px]">
          {{ t('purchaseOrder.ui.receiptReceivableLines', '待收行') }}
          {{ receiptReceivableCount }}
        </StatusBadge>
        <button
          v-if="canRecordReceipts"
          type="button"
          data-testid="purchase-order-open-receipt-modal"
          class="bg-primary flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-(--text-inverse) shadow-sm transition-colors hover:bg-primary/90"
          @click="$emit('open-receipt-modal')"
        >
          <AppIcon name="archive-box-arrow-down" class="size-3.5" />
          {{ t('purchaseOrder.action.recordReceipt', '登记收货') }}
        </button>
        <button
          v-if="canCloseShortages"
          type="button"
          data-testid="purchase-order-open-shortage-modal"
          class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300/70 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
          @click="$emit('open-shortage-modal')"
        >
          <AppIcon name="minus-circle" class="size-3.5" />
          {{ t('purchaseOrder.action.closeOutstanding', '关闭待收') }}
        </button>
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
              {{ receipt.product_name || '—' }}
            </span>
            <code
              class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[10px] text-(--text-secondary)"
            >
              {{ receipt.variant_sku || receipt.product_sku || '—' }}
            </code>
            <StatusBadge :variant="receipt.is_reversed ? 'default' : 'success'" class="text-[10px]">
              {{
                receipt.is_reversed
                  ? t('purchaseOrder.ui.receiptReversedTag', '已冲销')
                  : t('purchaseOrder.ui.receiptRecordedTag', '已入账')
              }}
            </StatusBadge>
            <StatusBadge
              v-if="helpers.canReverseReceipt(receipt)"
              variant="warning"
              class="text-[10px]"
            >
              {{ t('purchaseOrder.ui.receiptReversibleTag', '可冲销') }}
            </StatusBadge>
          </div>
          <div class="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-(--text-secondary)">
            <span>
              {{ t('purchaseOrder.form.receivedQty', '本次到货') }}
              {{ helpers.formatInteger(receipt.received_qty) }}
            </span>
            <span v-if="receipt.available_reversal_qty > 0">
              · {{ t('purchaseOrder.ui.availableReversalQty', '可冲销量') }}
              {{ helpers.formatInteger(receipt.available_reversal_qty) }}
            </span>
            <span v-if="receipt.reversed_qty > 0">
              · {{ t('purchaseOrder.ui.reversedQty', '已冲销') }}
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
              class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-[10px] font-medium break-all"
            >
              {{ key }}: {{ val }}
            </span>
          </div>
          <p
            v-if="receipt.note"
            class="mt-2 rounded-xl bg-(--bg-muted)/55 px-3 py-2 text-xs leading-5 break-all whitespace-pre-wrap text-(--text-secondary)"
          >
            {{ receipt.note }}
          </p>
        </div>

        <div class="flex flex-col justify-between rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3">
          <div class="space-y-2 text-xs text-(--text-secondary)">
            <div class="flex items-center justify-between gap-3">
              <span>{{ t('purchaseOrder.ui.receiptRecordId', '收货记录') }}</span>
              <code class="font-mono text-[11px] text-(--text-main)">{{ receipt.id }}</code>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span>{{ t('purchaseOrder.ui.receiptReversalCount', '冲销次数') }}</span>
              <span class="font-mono text-sm font-semibold text-(--text-main) tabular-nums">
                {{ helpers.formatInteger(receipt.reversal_count) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span>{{ t('purchaseOrder.ui.receiptLastReversedAt', '最近冲销') }}</span>
              <span class="text-right text-(--text-main)">
                {{ receipt.last_reversed_at ? helpers.formatDateTime(receipt.last_reversed_at) : '—' }}
              </span>
            </div>
          </div>
          <button
            v-if="helpers.canReverseReceipt(receipt)"
            type="button"
            data-testid="purchase-order-open-reversal-modal"
            class="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
            @click="$emit('open-reversal-modal', receipt)"
          >
            <AppIcon name="arrow-uturn-left" class="size-3.5" />
            {{ t('purchaseOrder.action.reverseReceipt', '冲销收货') }}
          </button>
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
        {{ t('purchaseOrder.ui.receiptLedgerEmptyTitle', '还没有收货记录') }}
      </p>
      <p class="mt-1 text-sm text-(--text-secondary)">
        {{
          canRecordReceipts
            ? t(
                'purchaseOrder.ui.receiptLedgerEmptyBody',
                '当前采购单还有待收货明细，可以登记本次到货。'
              )
            : t(
                'purchaseOrder.ui.receiptLedgerLockedBody',
                '当前状态下没有可登记的收货明细。'
              )
        }}
      </p>
    </div>
  </section>
</template>

<script setup>
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
