<template>
  <section data-testid="purchase-order-detail-summary" class="space-y-4">
    <div class="rounded-[1.5rem] border border-(--border-color)/65 bg-(--bg-card) p-5 shadow-none">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
            Purchase Order
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ detail?.po_no || t('purchaseOrder.detail.title', '采购单详情') }}
          </h2>
        </div>
        <div class="flex flex-col items-end gap-2">
          <StatusBadge
            v-if="detail?.status"
            data-testid="purchase-order-detail-status-chip"
            :variant="getStatusVariant(detail.status)"
          >
            {{ formatPurchaseOrderStatusLabel(detail.status, statusConfig) }}
          </StatusBadge>
          <template
            v-if="
              detail?.display_status ||
              detail?.ordered_qty ||
              detail?.received_qty ||
              detail?.cancelled_qty
            "
          >
            <StatusBadge
              data-testid="purchase-order-detail-progress-badge"
              :variant="helpers.getProgressStatusVariant(detail?.display_status)"
              class="text-xs"
            >
              {{ helpers.getProgressStatusLabel(detail?.display_status) }}
            </StatusBadge>
            <span
              data-testid="purchase-order-detail-progress-summary"
              class="text-right text-xs text-(--text-secondary)"
            >
              {{ helpers.buildReceiptProgressSummary(detail) }}
            </span>
          </template>
        </div>
      </div>
    </div>

    <div data-testid="purchase-order-detail-hero" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="card in summaryCards"
        :key="card.key"
        class="rounded-[1.35rem] border border-(--border-color)/65 bg-(--bg-card) p-4 shadow-none"
      >
        <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
          {{ card.label }}
        </p>
        <div class="mt-3 font-mono text-2xl font-semibold text-(--text-main) tabular-nums">
          {{ card.value }}
        </div>
        <p class="mt-1 text-xs leading-5 text-(--text-secondary)">{{ card.hint }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { formatPurchaseOrderStatusLabel } from '@/utils/display-labels';

const getStatusVariant = (status) => {
  if (['draft', 'cancelled'].includes(status)) return 'default';
  if (status === 'ordered') return 'warning';
  if (status === 'shipping') return 'primary';
  if (status === 'arrived') return 'info';
  return 'success';
};

const props = defineProps({
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
  t: {
    type: Function,
    required: true,
  },
  helpers: {
    type: Object,
    required: true,
  },
});

</script>
