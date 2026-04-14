<template>
  <div
    v-if="normalizedLines.length > 0"
    class="rounded-xl border border-(--border-color) bg-(--bg-card) p-4"
    data-testid="order-lines-card"
  >
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-primary text-sm font-medium">{{ t('order.detail.lineItems', '订单行') }}</h3>
      <span class="text-xs text-(--text-secondary)">{{ normalizedLines.length }}</span>
    </div>

    <div class="space-y-3">
      <div
        v-for="line in normalizedLines"
        :key="line.id"
        class="rounded-xl border border-(--border-subtle) bg-(--bg-muted)/40 p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-(--text-main)">
              {{ line.snapshotName || t('order.form.productName') }}
            </p>
            <p class="mt-1 text-xs text-(--text-secondary)">#{{ line.id }}</p>
          </div>
          <OrderLineProcurementState :status="line.displayStatus" />
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:grid-cols-7">
          <div class="rounded-lg bg-(--bg-card) px-2.5 py-2">
            <p class="text-(--text-secondary)">{{ t('order.detail.orderedQty', '下单') }}</p>
            <p class="mt-1 font-semibold text-(--text-main)">{{ line.orderedQuantity }}</p>
          </div>
          <div class="rounded-lg bg-(--bg-card) px-2.5 py-2">
            <p class="text-(--text-secondary)">{{ t('order.detail.procuredQty', '已采') }}</p>
            <p class="mt-1 font-semibold text-(--text-main)">{{ line.procuredQuantity }}</p>
          </div>
          <div class="rounded-lg bg-(--bg-card) px-2.5 py-2">
            <p class="text-(--text-secondary)">{{ t('order.detail.receivedQty', '到货') }}</p>
            <p class="mt-1 font-semibold text-(--text-main)">{{ line.receivedQuantity }}</p>
          </div>
          <div class="rounded-lg bg-(--bg-card) px-2.5 py-2">
            <p class="text-(--text-secondary)">{{ t('order.detail.shippedQty', '出货') }}</p>
            <p class="mt-1 font-semibold text-(--text-main)">{{ line.shippedQuantity }}</p>
          </div>
          <div class="rounded-lg bg-(--bg-card) px-2.5 py-2">
            <p class="text-(--text-secondary)">{{ t('order.detail.cancelledQty', '取消') }}</p>
            <p class="mt-1 font-semibold text-(--text-main)">{{ line.cancelledQuantity }}</p>
          </div>
          <div class="rounded-lg bg-(--bg-card) px-2.5 py-2">
            <p class="text-(--text-secondary)">{{ t('order.detail.reservedQty', '已预留') }}</p>
            <p class="mt-1 font-semibold text-(--text-main)">{{ line.reservedQuantity || 0 }}</p>
          </div>
          <div class="rounded-lg bg-(--bg-card) px-2.5 py-2">
            <p class="text-(--text-secondary)">{{ t('order.detail.returnedQty', '已退回') }}</p>
            <p class="mt-1 font-semibold text-(--text-main)">{{ line.returnedQuantity || 0 }}</p>
          </div>
        </div>

        <OrderLineCommandPanel
          v-if="mode === 'admin'"
          :line="line"
          :order-status="orderStatus"
          :delivery-status="deliveryStatus"
          :loading="lineCommandState.pending && lineCommandState.lineId === line.id"
          :error="lineCommandState.lineId === line.id ? lineCommandState.error : ''"
          @command="$emit('line-command', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import OrderLineProcurementState from './OrderLineProcurementState.vue';
import OrderLineCommandPanel from './OrderLineCommandPanel.vue';

const props = defineProps({
  lines: {
    type: Array,
    default: () => [],
  },
  mode: {
    type: String,
    default: 'sales',
  },
  orderStatus: {
    type: String,
    default: '',
  },
  deliveryStatus: {
    type: String,
    default: 'not_shipped',
  },
  lineCommandState: {
    type: Object,
    default: () => ({
      pending: false,
      lineId: null,
      action: '',
      error: '',
    }),
  },
});

defineEmits(['line-command']);

const { t } = useI18n();

const normalizedLines = computed(() => (Array.isArray(props.lines) ? props.lines : []));
</script>
