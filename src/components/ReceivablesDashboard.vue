<template>
  <div class="space-y-6">
    <!-- 标题 -->
    <h2 class="text-primary text-lg font-semibold">{{ t('order.receivables.title') }}</h2>

    <!-- 加载状态 -->
    <div v-if="loading" class="py-12 text-center">
      <div
        class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
      />
    </div>

    <template v-else>
      <!-- 汇总卡片 -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5">
          <div class="text-sm text-(--text-secondary)">
            {{ t('order.receivables.totalOutstanding') }}
          </div>
          <div class="text-danger mt-2 text-3xl font-bold">{{ summary.totalOutstanding }}</div>
          <div class="mt-1 text-xs text-(--text-secondary)">
            {{ summary.orderCount }} {{ t('order.receivables.orderCount') }}
          </div>
        </div>

        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5">
          <div class="text-sm text-(--text-secondary)">{{ t('order.receivables.totalPaid') }}</div>
          <div class="text-success mt-2 text-3xl font-bold">{{ summary.totalPaid }}</div>
        </div>

        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5">
          <div class="text-sm text-(--text-secondary)">{{ t('order.receivables.orderCount') }}</div>
          <div class="text-primary mt-2 text-3xl font-bold">{{ summary.orderCount }}</div>
        </div>
      </div>

      <!-- 账龄分析 -->
      <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5">
        <h3 class="text-primary mb-4 text-sm font-medium">{{ t('order.receivables.aging') }}</h3>

        <div class="space-y-3">
          <div v-for="bucket in summary.aging" :key="bucket.label" class="flex items-center gap-4">
            <div class="w-20 text-sm text-(--text-secondary)">
              {{ getAgingLabel(bucket.label) }}
            </div>
            <div class="flex-1">
              <div class="h-6 overflow-hidden rounded-full bg-(--bg-secondary)">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="getAgingColor(bucket.label)"
                  :style="{ width: getAgingPercent(bucket.totalPaid) + '%' }"
                />
              </div>
            </div>
            <div class="w-20 text-right text-sm font-medium">
              {{ bucket.totalPaid }}
            </div>
            <div class="w-16 text-right text-xs text-(--text-secondary)">
              {{ t('receivables.orderCount', '{count} 单', { count: bucket.orderCount }) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 欠款客户排行 -->
      <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5">
        <h3 class="text-primary mb-4 text-sm font-medium">
          {{ t('order.receivables.topDebtors') }}
        </h3>

        <div v-if="summary.topDebtors.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-(--border-color)">
                <th class="px-4 py-3 text-left text-(--text-secondary)">
                  {{ t('order.receivables.customer') }}
                </th>
                <th class="px-4 py-3 text-left text-(--text-secondary)">
                  {{ t('order.receivables.company') }}
                </th>
                <th class="px-4 py-3 text-right text-(--text-secondary)">
                  {{ t('order.receivables.orderCountShort') }}
                </th>
                <th class="px-4 py-3 text-right text-(--text-secondary)">
                  {{ t('order.receivables.outstandingAmount') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="debtor in summary.topDebtors"
                :key="debtor.customerId"
                class="border-b border-(--border-color) last:border-0"
              >
                <td class="px-4 py-3">{{ debtor.customerName }}</td>
                <td class="px-4 py-3 text-(--text-secondary)">
                  {{ debtor.customerCompany || '-' }}
                </td>
                <td class="px-4 py-3 text-right">{{ debtor.orderCount }}</td>
                <td class="text-danger px-4 py-3 text-right font-medium">
                  {{ debtor.outstanding }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="py-8 text-center text-sm text-(--text-secondary)">
          {{ t('order.receivables.noDebtors') }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import { formatReadableLabel } from '@/utils/event-display';

const { t } = useI18n();
const { authFetch } = useAuth();

const loading = ref(true);
const summary = ref({
  orderCount: 0,
  totalQuantity: 0,
  totalPaid: 0,
  totalOutstanding: 0,
  aging: [],
  topDebtors: [],
});

/**
 * 加载应收账款数据
 */
async function loadReceivables() {
  loading.value = true;
  try {
    const res = await authFetch(API.MANAGE_RECEIVABLES);
    const data = await res.json();

    if (data.success) {
      summary.value = data.data;
    }
  } catch {
    // 静默失败
  } finally {
    loading.value = false;
  }
}

/**
 * 获取账龄标签
 */
function getAgingLabel(label) {
  const labels = {
    '0-30': t('order.receivables.agingLabels.0-30'),
    '31-60': t('order.receivables.agingLabels.31-60'),
    '61-90': t('order.receivables.agingLabels.61-90'),
    '90+': t('order.receivables.agingLabels.90+'),
  };
  return labels[label] || formatReadableLabel(label);
}

/**
 * 获取账龄颜色
 */
function getAgingColor(label) {
  const colors = {
    '0-30': 'bg-success',
    '31-60': 'bg-warning',
    '61-90': 'bg-orange-500',
    '90+': 'bg-danger',
  };
  return colors[label] || 'bg-primary';
}

/**
 * 计算账龄百分比
 */
function getAgingPercent(amount) {
  const maxAmount = Math.max(...summary.value.aging.map((b) => b.totalPaid), 1);
  return Math.min(100, (amount / maxAmount) * 100);
}

onMounted(() => {
  loadReceivables();
});
</script>
