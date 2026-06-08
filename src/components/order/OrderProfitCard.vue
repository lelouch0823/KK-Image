<template>
  <div v-if="profit" class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
    <!-- 标题栏 -->
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-primary text-sm font-medium">{{ t('order.profit.title') }}</h3>
      <span
        v-if="profit.costComplete"
        class="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success"
      >
        {{ t('order.profit.costComplete') }}
      </span>
      <span v-else class="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
        {{ t('order.profit.costIncomplete') }}
      </span>
    </div>

    <!-- 利润汇总 -->
    <div class="mb-4 grid grid-cols-3 gap-3">
      <div class="rounded-lg bg-(--bg-secondary) p-3 text-center">
        <div class="text-xs text-(--text-secondary)">{{ t('order.profit.revenue') }}</div>
        <div class="text-primary mt-1 text-lg font-semibold">
          {{ formatCurrency(profit.revenue) }}
        </div>
      </div>
      <div class="rounded-lg bg-(--bg-secondary) p-3 text-center">
        <div class="text-xs text-(--text-secondary)">{{ t('order.profit.cost') }}</div>
        <div class="mt-1 text-lg font-semibold text-(--text-main)">
          {{ formatCurrency(profit.cost) }}
        </div>
      </div>
      <div class="rounded-lg bg-(--bg-secondary) p-3 text-center">
        <div class="text-xs text-(--text-secondary)">{{ t('order.profit.profit') }}</div>
        <div
          class="mt-1 text-lg font-semibold"
          :class="profit.profit >= 0 ? 'text-success' : 'text-danger'"
        >
          {{ formatCurrency(profit.profit) }}
        </div>
      </div>
    </div>

    <!-- 利润率 -->
    <div
      v-if="profit.margin !== null"
      class="mb-4 flex items-center justify-between rounded-lg bg-(--bg-secondary) px-3 py-2"
    >
      <span class="text-xs text-(--text-secondary)">{{ t('order.profit.margin') }}</span>
      <span
        class="text-sm font-semibold"
        :class="profit.margin >= 0 ? 'text-success' : 'text-danger'"
      >
        {{ profit.margin }}%
      </span>
    </div>

    <!-- 展开/收起明细 -->
    <AppButton
      v-if="profit.lines && profit.lines.length > 0"
      variant="ghost"
      size="sm"
      class="flex w-full items-center justify-between"
      @click="showBreakdown = !showBreakdown"
    >
      <span>{{ t('order.profit.breakdown') }}</span>
      <template #icon-right>
        <AppIcon
          name="chevron-down"
          class="size-3.5 transition-transform"
          :class="{ 'rotate-180': showBreakdown }"
        />
      </template>
    </AppButton>

    <!-- 利润明细列表 -->
    <div v-if="showBreakdown && profit.lines" class="mt-2 space-y-2">
      <div
        v-for="line in profit.lines"
        :key="line.orderLineId"
        class="rounded-lg border border-(--border-color) p-3"
      >
        <div class="mb-1 flex items-center justify-between">
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-(--text-main)">
            {{ line.productName || t('common.unknown') }}
          </span>
          <span class="ml-2 text-xs text-(--text-secondary)">x{{ line.quantity }}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span class="text-(--text-secondary)">{{ t('order.profit.unitPrice') }}</span>
            <span class="ml-1 text-(--text-main)">{{
              line.unitPrice != null ? formatCurrency(line.unitPrice) : '-'
            }}</span>
          </div>
          <div>
            <span class="text-(--text-secondary)">{{ t('order.profit.unitCost') }}</span>
            <span class="ml-1 text-(--text-main)">{{
              line.unitCost != null ? formatCurrency(line.unitCost) : t('order.profit.costMissing')
            }}</span>
          </div>
          <div class="text-right">
            <span class="text-(--text-secondary)">{{ t('order.profit.lineProfit') }}</span>
            <span
              class="ml-1 font-medium"
              :class="line.profit >= 0 ? 'text-success' : 'text-danger'"
            >
              {{ formatCurrency(line.profit) }}
            </span>
          </div>
        </div>
        <!-- 成本来源标记 -->
        <div class="mt-1.5 flex items-center gap-1">
          <span class="rounded px-1.5 py-0.5 text-xs" :class="costSourceClass(line.costSource)">
            {{ formatOrderCostSourceLabel(t, line.costSource) }}
          </span>
          <span v-if="line.margin !== null" class="text-xs text-(--text-muted)">
            {{ t('order.profit.lineMargin') }}: {{ line.margin }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { formatOrderCostSourceLabel } from '@/utils/display-labels';

const props = defineProps({
  profit: {
    type: Object,
    default: null,
  },
});

const { t } = useI18n();
const showBreakdown = ref(false);

function formatCurrency(value) {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function costSourceClass(source) {
  switch (source) {
    case 'po':
      return 'bg-success/10 text-success';
    case 'variant':
      return 'bg-info/10 text-info';
    case 'missing':
    default:
      return 'bg-warning/10 text-warning';
  }
}
</script>
