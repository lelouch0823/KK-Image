<template>
  <div class="print-view">
    <!-- 打印页眉 -->
    <div class="mb-6 flex items-start justify-between border-b-2 border-black pb-4">
      <div>
        <h1 class="text-2xl font-bold tracking-wider text-black uppercase">KK-Image System</h1>
        <div class="mt-2 space-y-0.5 text-sm text-(--text-secondary)">
          <p>
            {{ t('order.orderNo') }}:
            <span class="ml-2 font-mono text-base font-bold text-black">{{ order.orderNo }}</span>
          </p>
          <p>
            {{ t('order.createdAt') }}:
            <span class="ml-2 text-black">{{ formatTime(order.createdAt) }}</span>
          </p>
        </div>
      </div>
      <div class="text-right">
        <div
          class="inline-block rounded-sm border-2 border-black px-4 py-1 font-bold text-black uppercase"
        >
          {{ t(`order.statuses.${order.status}`) }}
        </div>
      </div>
    </div>

    <!-- 订单信息网格 -->
    <div class="mb-8 break-inside-avoid">
      <h2
        class="mb-3 border-b border-(--border-color) pb-1 text-sm font-bold tracking-wide text-(--text-muted) uppercase"
      >
        {{ t('order.detail.currentInfo') }}
      </h2>
      <dl class="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
        <div class="grid grid-cols-[80px_1fr]">
          <dt class="text-(--text-secondary)">{{ t('order.form.productName') }}</dt>
          <dd class="font-medium text-black">{{ displayData.name || '-' }}</dd>
        </div>
        <div class="grid grid-cols-[80px_1fr]">
          <dt class="text-(--text-secondary)">{{ t('order.form.quantity') }}</dt>
          <dd class="font-medium text-black">{{ orderQuantity }}</dd>
        </div>
        <div class="grid grid-cols-[80px_1fr]">
          <dt class="text-(--text-secondary)">{{ t('order.form.brand') }}</dt>
          <dd class="font-medium text-black">{{ displayData.brand || '-' }}</dd>
        </div>
        <div class="grid grid-cols-[80px_1fr]">
          <dt class="text-(--text-secondary)">{{ t('order.form.series') }}</dt>
          <dd class="font-medium text-black">{{ displayData.series || '-' }}</dd>
        </div>
        <div class="grid grid-cols-[80px_1fr]">
          <dt class="text-(--text-secondary)">{{ t('order.form.size') }}</dt>
          <dd class="font-medium text-black">{{ displayData.size || '-' }}</dd>
        </div>
        <div class="grid grid-cols-[80px_1fr]">
          <dt class="text-(--text-secondary)">{{ t('order.form.color') }}</dt>
          <dd class="font-medium text-black">{{ displayData.color || '-' }}</dd>
        </div>
        <div class="grid grid-cols-[80px_1fr]">
          <dt class="text-(--text-secondary)">{{ t('order.form.material') }}</dt>
          <dd class="font-medium text-black">{{ displayData.material || '-' }}</dd>
        </div>
        <div class="col-span-2 mt-2 border-t border-dashed border-(--border-color) pt-2">
          <dt class="mb-1 text-xs text-(--text-secondary)">{{ t('order.form.remark') }}</dt>
          <dd
            class="rounded border border-(--border-color) bg-(--bg-muted) p-3 text-sm leading-relaxed text-black"
          >
            {{ displayData.remark || '-' }}
          </dd>
        </div>
      </dl>
    </div>

    <div v-if="orderLines.length > 0" class="mb-8 break-inside-avoid">
      <h2
        class="mb-3 border-b border-(--border-color) pb-1 text-sm font-bold tracking-wide text-(--text-muted) uppercase"
      >
        {{ t('order.detail.lineItems', '订单行') }}
      </h2>
      <div class="space-y-3">
        <div
          v-for="line in orderLines"
          :key="line.id"
          class="rounded border border-(--border-color) p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-semibold text-black">{{ line.snapshotName || '-' }}</p>
              <p class="mt-1 text-xs text-(--text-secondary)">#{{ line.id }}</p>
            </div>
            <OrderLineProcurementState :status="line.displayStatus" />
          </div>
          <div class="mt-3 grid grid-cols-5 gap-3 text-xs">
            <div>
              <p class="text-(--text-secondary)">{{ t('order.detail.orderedQty', '下单') }}</p>
              <p class="mt-1 font-semibold text-black">{{ line.orderedQuantity }}</p>
            </div>
            <div>
              <p class="text-(--text-secondary)">{{ t('order.detail.procuredQty', '已采') }}</p>
              <p class="mt-1 font-semibold text-black">{{ line.procuredQuantity }}</p>
            </div>
            <div>
              <p class="text-(--text-secondary)">{{ t('order.detail.receivedQty', '到货') }}</p>
              <p class="mt-1 font-semibold text-black">{{ line.receivedQuantity }}</p>
            </div>
            <div>
              <p class="text-(--text-secondary)">{{ t('order.detail.shippedQty', '出货') }}</p>
              <p class="mt-1 font-semibold text-black">{{ line.shippedQuantity }}</p>
            </div>
            <div>
              <p class="text-(--text-secondary)">{{ t('order.detail.cancelledQty', '取消') }}</p>
              <p class="mt-1 font-semibold text-black">{{ line.cancelledQuantity }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片区域 -->
    <div v-if="order.files && order.files.length > 0" class="mb-8 break-inside-avoid">
      <h2
        class="mb-3 border-b border-(--border-color) pb-1 text-sm font-bold tracking-wide text-(--text-muted) uppercase"
      >
        {{ t('order.detail.images') }}
      </h2>
      <div class="grid grid-cols-4 gap-4">
        <div v-for="file in order.files" :key="file.id" class="break-inside-avoid">
          <div class="aspect-square overflow-hidden rounded-sm border border-(--border-color) bg-(--bg-muted)">
            <AppImage :src="file.url" :lazy="false" no-transition class="size-full" alt="" />
          </div>
        </div>
      </div>
    </div>

    <!-- 操作审计日志 (Table Mode) -->
    <div v-if="order.timeline && order.timeline.length > 0">
      <h2
        class="mb-3 border-b border-(--border-color) pb-1 text-sm font-bold tracking-wide text-(--text-muted) uppercase"
      >
        {{ t('order.detail.timeline') }}
      </h2>
      <OrderTimeline :timeline="order.timeline" mode="table" :max-items="999" />
    </div>

    <!-- 页脚 -->
    <div
      class="fixed bottom-0 left-0 w-full border-t border-(--border-color) bg-white pt-2 text-center text-[10px] text-(--text-muted)"
    >
      Generated by KK-Image System • {{ new Date().toLocaleString() }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppImage from '@/components/ui/AppImage.vue';
import { useI18n } from '@/composables/useI18n';
import { formatTimelineTime } from '@/utils/formatters';
import { buildOrderDetailDisplayData, isMultilineOrder, resolveOrderQuantity } from '@/utils/order-display';
import OrderLineProcurementState from './OrderLineProcurementState.vue';
import OrderTimeline from './OrderTimeline.vue';

const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
});

const { t } = useI18n();

const orderLines = computed(() => (Array.isArray(props.order.lines) ? props.order.lines : []));
const orderQuantity = computed(() => resolveOrderQuantity(props.order));
const multilineSummaryName = computed(() =>
  isMultilineOrder(props.order) ? t('order.detail.multilineSummary', { count: orderLines.value.length }) : ''
);
const displayData = computed(() =>
  buildOrderDetailDisplayData(props.order, {
    multilineSummaryName: multilineSummaryName.value,
  })
);

const formatTime = (timestamp) => formatTimelineTime(timestamp);
</script>

<style scoped>
/* Print View 默认隐藏，仅在打印时显示 */
.print-view {
  display: none;
}

@media print {
  .print-view {
    display: block !important;
    width: 100%;
    color: black;
    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif;
  }

  .break-inside-avoid {
    break-inside: avoid;
  }
}
</style>
