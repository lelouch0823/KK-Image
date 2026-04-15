<template>
  <Modal
    :model-value="show"
    size="6xl"
    :closable="false"
    body-class="!p-0"
    @update:model-value="handleModalVisibilityChange"
  >
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
            Detail Workspace
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ detail?.po_no || t('purchaseOrder.detail.title', '采购单详情') }}
          </h2>
        </div>
        <AppButton
          data-testid="purchase-order-detail-close"
          variant="ghost"
          size="sm"
          class="h-9 w-9 px-0"
          @click="$emit('close')"
        >
          <AppIcon name="x-mark" class="size-5" />
        </AppButton>
      </div>
    </template>

    <div data-testid="purchase-order-detail-shell" class="min-h-0 px-6 py-4">
      <StatePanel
        v-if="detailLoading"
        variant="plain"
        class="flex min-h-[20rem] items-center justify-center"
      >
        <div class="flex flex-col items-center gap-3 text-center">
          <div class="skeleton-shimmer size-14 rounded-2xl bg-(--bg-muted)"></div>
          <div>
            <h3 class="text-sm font-semibold text-(--text-main)">
              {{ t('purchaseOrder.detail.loadingTitle', '正在刷新采购单详情') }}
            </h3>
            <p class="mt-1 text-sm text-(--text-secondary)">
              {{
                t(
                  'purchaseOrder.detail.loadingBody',
                  '请稍候，系统正在加载采购进度、费用与收货台账。'
                )
              }}
            </p>
          </div>
        </div>
      </StatePanel>

      <StatePanel
        v-else-if="!detail"
        variant="plain"
        class="flex min-h-[20rem] items-center justify-center"
      >
        <div class="text-center">
          <p class="text-sm font-medium text-(--text-main)">
            {{ t('purchaseOrder.detail.loadFailedTitle', '采购单详情加载失败') }}
          </p>
          <p class="mt-1 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.detail.loadFailedHint', '可以重试重新加载采购单详情。') }}
          </p>
          <AppButton
            data-testid="purchase-order-detail-retry"
            class="mt-4"
            @click="$emit('retry-detail')"
          >
            {{ t('common.retry', '重试') }}
          </AppButton>
        </div>
      </StatePanel>

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

        <StatePanel
          v-if="detail.remark"
          variant="plain"
          class="rounded-2xl border border-(--border-color)/70 bg-(--bg-card) p-4"
        >
          <h3 class="mb-2 text-sm font-semibold text-(--text-main)">
            {{ t('purchaseOrder.form.remark') }}
          </h3>
          <p class="text-sm break-all whitespace-pre-wrap text-(--text-secondary)">
            {{ detail.remark }}
          </p>
        </StatePanel>
      </div>
    </div>

    <template v-if="detail" #footer>
      <ActionBar data-testid="purchase-order-detail-footer">
        <template #leading>
          <AppButton
            v-if="nextStatuses.includes('cancelled')"
            variant="danger"
            @click="$emit('status-update', 'cancelled')"
          >
            {{ t('purchaseOrder.action.cancelOrder') }}
          </AppButton>
        </template>
        <AppButton
          v-for="ns in nextStatuses.filter((s) => s !== 'cancelled')"
          :key="ns"
          @click="$emit('status-update', ns)"
        >
          {{ t('purchaseOrder.action.updateTo') }}:
          {{ statusConfig[ns]?.label || ns }}
        </AppButton>
      </ActionBar>
    </template>
  </Modal>
</template>

<script setup>
import ActionBar from '@/design-system/composed/ActionBar.vue';
import StatePanel from '@/design-system/composed/StatePanel.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Modal from '@/components/ui/Modal.vue';
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

const emit = defineEmits([
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

const handleModalVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close');
  }
};
</script>
