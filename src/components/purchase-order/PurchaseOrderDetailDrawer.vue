<template>
  <div
    v-if="show"
    data-testid="purchase-order-detail-shell"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    <div
      class="relative flex h-full max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)]"
    >
      <div class="flex items-center justify-between border-b border-(--border-color) px-6 py-5">
        <div>
          <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
            Detail Workspace
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ detail?.po_no || t('purchaseOrder.detail.title', '采购单详情') }}
          </h2>
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
        <div v-if="detailLoading" class="flex min-h-[20rem] items-center justify-center">
          <div class="flex flex-col items-center gap-3 text-center">
            <div class="skeleton-shimmer size-14 rounded-2xl bg-(--bg-muted)"></div>
            <div>
              <h3 class="text-sm font-semibold text-(--text-main)">
                {{ t('purchaseOrder.detail.loadingTitle', '正在刷新采购单详情') }}
              </h3>
              <p class="mt-1 text-sm text-(--text-secondary)">
                {{ t('purchaseOrder.detail.loadingBody', '请稍候，系统正在加载采购进度、费用与收货台账。') }}
              </p>
            </div>
          </div>
        </div>

        <div v-else-if="!detail" class="flex min-h-[20rem] items-center justify-center">
          <div class="text-center">
            <p class="text-sm font-medium text-(--text-main)">
              {{ t('purchaseOrder.detail.loadFailedTitle', '采购单详情加载失败') }}
            </p>
            <p class="mt-1 text-sm text-(--text-secondary)">
              {{ t('purchaseOrder.detail.loadFailedHint', '可以重试重新加载采购单详情。') }}
            </p>
            <button
              type="button"
              data-testid="purchase-order-detail-retry"
              class="bg-primary mt-4 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-(--text-inverse)"
              @click="$emit('retry-detail')"
            >
              {{ t('common.retry', '重试') }}
            </button>
          </div>
        </div>

        <div v-else class="space-y-5">
          <PurchaseOrderDetailSummary
            :detail="detail"
            :status-config="statusConfig"
            :summary-cards="summaryCards"
            :t="t"
            :helpers="helpers"
          />

          <div class="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div class="space-y-5">
              <PurchaseOrderDetailProgress
                :detail="detail"
                :steps-list="stepsList"
                :status-config="statusConfig"
                :t="t"
                :helpers="helpers"
              />
              <PurchaseOrderDetailCost
                :detail="detail"
                :t="t"
                :helpers="helpers"
                @open-cost-modal="$emit('open-cost-modal')"
              />
            </div>

            <PurchaseOrderItemsPanel
              :detail="detail"
              :t="t"
              :helpers="helpers"
              :get-file-url="getFileUrl"
              @open-order-picker="$emit('open-order-picker', $event)"
              @open-product-picker="$emit('open-product-picker', $event)"
              @view-product-detail="$emit('view-product-detail', $event)"
              @update-item="$emit('update-item', $event.itemId, $event.field, $event.value)"
              @remove-item="$emit('remove-item', $event)"
            />
          </div>

          <PurchaseOrderReceiptsPanel
            :receipt-timeline="receiptTimeline"
            :receipt-receivable-count="receiptReceivableCount"
            :can-record-receipts="canRecordReceipts"
            :can-close-shortages="canCloseShortages"
            :t="t"
            :helpers="helpers"
            @open-receipt-modal="$emit('open-receipt-modal')"
            @open-shortage-modal="$emit('open-shortage-modal')"
            @open-reversal-modal="$emit('open-reversal-modal', $event)"
          />

          <div
            v-if="detail.remark"
            class="rounded-2xl border border-(--border-color)/70 bg-(--bg-card) p-4 shadow-sm"
          >
            <h3 class="mb-2 text-sm font-semibold text-(--text-main)">
              {{ t('purchaseOrder.form.remark') }}
            </h3>
            <p class="text-sm break-all whitespace-pre-wrap text-(--text-secondary)">
              {{ detail.remark }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="detail"
        data-testid="purchase-order-detail-footer"
        class="flex flex-col gap-3 border-t border-(--border-color) bg-(--bg-card) px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="flex items-center gap-3">
          <button
            v-if="nextStatuses.includes('cancelled')"
            class="text-danger cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-danger/10"
            @click="$emit('status-update', 'cancelled')"
          >
            {{ t('purchaseOrder.action.cancelOrder') }}
          </button>
        </div>
        <div class="flex items-center gap-3">
          <button
            v-for="ns in nextStatuses.filter((s) => s !== 'cancelled')"
            :key="ns"
            class="bg-primary cursor-pointer rounded-xl px-6 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:bg-primary/90 hover:shadow"
            @click="$emit('status-update', ns)"
          >
            {{ t('purchaseOrder.action.updateTo') }}:
            {{ statusConfig[ns]?.label || ns }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue';
import PurchaseOrderDetailSummary from '@/components/purchase-order/PurchaseOrderDetailSummary.vue';
import PurchaseOrderDetailProgress from '@/components/purchase-order/PurchaseOrderDetailProgress.vue';
import PurchaseOrderDetailCost from '@/components/purchase-order/PurchaseOrderDetailCost.vue';
import PurchaseOrderItemsPanel from '@/components/purchase-order/PurchaseOrderItemsPanel.vue';
import PurchaseOrderReceiptsPanel from '@/components/purchase-order/PurchaseOrderReceiptsPanel.vue';

defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  detailLoading: {
    type: Boolean,
    default: false,
  },
  detail: {
    type: Object,
    default: null,
  },
  statusConfig: {
    type: Object,
    default: () => ({}),
  },
  summaryCards: {
    type: Array,
    default: () => [],
  },
  nextStatuses: {
    type: Array,
    default: () => [],
  },
  stepsList: {
    type: Array,
    default: () => [],
  },
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
  getFileUrl: {
    type: Function,
    required: true,
  },
});

defineEmits([
  'close',
  'retry-detail',
  'status-update',
  'open-cost-modal',
  'open-order-picker',
  'open-product-picker',
  'view-product-detail',
  'update-item',
  'remove-item',
  'open-receipt-modal',
  'open-shortage-modal',
  'open-reversal-modal',
]);
</script>
