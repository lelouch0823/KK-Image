<template>
  <AppTable
    :columns="columns"
    :data="list"
    :loading="loading"
    :empty-text="emptyText"
    :virtual="list.length > 50"
    no-border
    clickable
    @row-click="$emit('row-click', $event)"
  >
    <template #toolbar>
      <div
        class="mb-3 flex flex-col gap-2 border-b border-(--border-color)/35 px-1 pb-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h3 class="text-sm font-semibold text-(--text-main)">Order Ledger</h3>
          <p class="mt-1 text-xs text-(--text-secondary)">
            {{
              t(
                'purchaseOrder.ui.tableHint',
                '主状态和到货进度在同一列聚合展示，便于快速扫读链路卡点。'
              )
            }}
          </p>
        </div>
        <div class="text-xs text-(--text-secondary) lg:text-right">
          {{ t('purchaseOrder.ui.liveHint', '点击行可查看采购链路详情') }}
        </div>
      </div>
    </template>

    <template #cell-po_no="{ row: po }">
      <code
        data-testid="purchase-order-po-chip"
        class="inline-flex items-center rounded-full border border-(--border-color)/70 bg-(--bg-muted) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.04em] text-(--text-main)"
      >
        {{ po.po_no }}
      </code>
    </template>

    <template #cell-status="{ row: po }">
      <div class="flex flex-col items-start gap-1.5">
        <StatusBadge
          v-if="po.status"
          data-testid="purchase-order-status-badge"
          :variant="getListStatusVariant(po.status)"
          class="ring-1 ring-(--border-color)/40"
        >
          {{ statusConfig[po.status]?.label || po.status }}
        </StatusBadge>
        <template
          v-if="po.display_status || po.ordered_qty || po.received_qty || po.cancelled_qty"
        >
          <StatusBadge
            data-testid="purchase-order-progress-badge"
            :variant="getProgressStatusVariant(po.display_status)"
            class="text-[10px]"
          >
            {{ getProgressStatusLabel(po.display_status) }}
          </StatusBadge>
          <span
            data-testid="purchase-order-progress-summary"
            class="text-[11px] text-(--text-secondary)"
          >
            {{ buildReceiptProgressSummary(po) }}
          </span>
        </template>
      </div>
    </template>

    <template #cell-item_count="{ row: po }">
      <span class="font-medium text-(--text-main)">{{ po.item_count || 0 }}</span>
    </template>

    <template #cell-total_goods_cost="{ row: po }">
      <span
        data-testid="purchase-order-total-cost"
        class="inline-flex min-w-[7.5rem] justify-end font-mono text-sm font-semibold text-(--text-main) tabular-nums"
      >
        {{ formatPurchaseCurrency(po.total_goods_cost, po.currency) }}
      </span>
    </template>

    <template #cell-remark="{ row: po }">
      <span class="max-w-[150px] truncate text-(--text-secondary)" :title="po.remark">{{
        po.remark || '-'
      }}</span>
    </template>

    <template #cell-created_at="{ row: po }">
      <span class="text-(--text-secondary)">{{ formatDate(po.created_at) }}</span>
    </template>
  </AppTable>
</template>

<script setup>
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { useI18n } from '@/composables/useI18n';

defineProps({
  columns: {
    type: Array,
    default: () => [],
  },
  list: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  emptyText: {
    type: String,
    default: '',
  },
  statusConfig: {
    type: Object,
    default: () => ({}),
  },
  formatDate: {
    type: Function,
    required: true,
  },
  formatPurchaseCurrency: {
    type: Function,
    required: true,
  },
  buildReceiptProgressSummary: {
    type: Function,
    required: true,
  },
  getProgressStatusLabel: {
    type: Function,
    required: true,
  },
  getProgressStatusVariant: {
    type: Function,
    required: true,
  },
  getListStatusVariant: {
    type: Function,
    required: true,
  },
});

defineEmits(['row-click']);

const { t } = useI18n();
</script>
