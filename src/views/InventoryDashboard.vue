<template>
  <div class="space-y-6">
    <!-- 权限不足状态 -->
    <div
      v-if="errorCode === ErrorCode.FORBIDDEN"
      class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-8"
    >
      <PermissionDeniedState
        :title="t('inventoryDashboard.permissionDenied')"
        :description="error || t('inventoryDashboard.permissionDeniedDesc')"
        home-to="/admin/forbidden"
        :home-text="t('common.viewDetails')"
        @retry="init"
      />
    </div>

    <template v-else>
      <DashboardShell
        :title="t('inventoryDashboard.title')"
        :description="t('inventoryDashboard.subtitle')"
      >
        <!-- ===== 摘要卡片 ===== -->
        <template #summary>
          <StatGroup :columns="4">
            <template v-if="loading && !data">
              <div
                v-for="i in 4"
                :key="'sk-' + i"
                class="relative overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) p-4 sm:p-5"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1 space-y-3">
                    <div class="skeleton-shimmer h-3.5 w-16 rounded bg-(--bg-muted)" />
                    <div class="skeleton-shimmer h-8 w-12 rounded bg-(--bg-muted)" />
                  </div>
                  <div class="skeleton-shimmer size-9 rounded-xl bg-(--bg-muted) sm:size-10" />
                </div>
              </div>
            </template>

            <template v-else-if="data?.summary">
              <MetricTile
                :label="t('inventoryDashboard.summary.totalSkus')"
                :value="data.summary.totalSkus"
                icon="cube"
                tone="primary"
                flat
              />
              <MetricTile
                :label="t('inventoryDashboard.summary.lowStock')"
                :value="data.summary.lowStockCount"
                icon="exclamation-triangle"
                tone="warning"
                flat
              />
              <MetricTile
                :label="t('inventoryDashboard.summary.zeroStock')"
                :value="data.summary.zeroStockCount"
                icon="archive-box-x-mark"
                tone="danger"
                flat
              />
              <MetricTile
                :label="t('inventoryDashboard.summary.inventoryValue')"
                :value="formatCurrency(data.summary.totalInventoryValue)"
                icon="banknotes"
                tone="success"
                flat
              />
            </template>
          </StatGroup>
        </template>

        <!-- ===== 主内容区 ===== -->
        <template #main>
          <!-- 网络错误 -->
          <div
            v-if="showRequestErrorState"
            class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-8"
          >
            <EmptyState
              icon="search"
              :title="t('common.error.network_error')"
              :description="error || t('common.text.load_failed')"
            >
              <template #action>
                <AppButton variant="secondary" :text="t('common.action.retry')" @click="init" />
              </template>
            </EmptyState>
          </div>

          <template v-else>
            <!-- 低库存预警表格 -->
            <section class="space-y-3">
              <h2 class="text-base font-semibold text-(--text-main)">
                {{ t('inventoryDashboard.lowStock.title') }}
              </h2>
              <AppTable
                :columns="lowStockColumns"
                :data="data?.lowStockItems || []"
                :loading="loading"
                :empty-text="t('inventoryDashboard.lowStock.empty')"
                no-border
              >
                <template #cell-productName="{ row }">
                  <div>
                    <div class="text-primary max-w-[200px] truncate font-medium" :title="row.productName">
                      {{ row.productName }}
                    </div>
                    <div
                      v-if="row.variantLabel"
                      class="max-w-[200px] truncate text-xs text-(--text-secondary)"
                      :title="row.variantLabel"
                    >
                      {{ row.variantLabel }}
                    </div>
                  </div>
                </template>

                <template #cell-sku="{ row }">
                  <AppTableCodeChip :value="row.sku" max-width="11rem" />
                </template>

                <template #cell-available="{ row }">
                  <span class="font-medium text-(--text-main)">{{ row.available }}</span>
                </template>

                <template #cell-onHand="{ row }">
                  <span class="text-(--text-secondary)">{{ row.onHand }}</span>
                </template>

                <template #cell-reserved="{ row }">
                  <span class="text-(--text-secondary)">{{ row.reserved }}</span>
                </template>

                <template #cell-alertThreshold="{ row }">
                  <span class="text-(--text-secondary)">{{ row.alertThreshold }}</span>
                </template>
              </AppTable>
            </section>

            <!-- 零库存表格 -->
            <section class="space-y-3">
              <h2 class="text-base font-semibold text-(--text-main)">
                {{ t('inventoryDashboard.zeroStock.title') }}
              </h2>
              <AppTable
                :columns="zeroStockColumns"
                :data="data?.zeroStockItems || []"
                :loading="loading"
                :empty-text="t('inventoryDashboard.zeroStock.empty')"
                no-border
              >
                <template #cell-productName="{ row }">
                  <div>
                    <div class="text-primary max-w-[200px] truncate font-medium" :title="row.productName">
                      {{ row.productName }}
                    </div>
                    <div
                      v-if="row.variantLabel"
                      class="max-w-[200px] truncate text-xs text-(--text-secondary)"
                      :title="row.variantLabel"
                    >
                      {{ row.variantLabel }}
                    </div>
                  </div>
                </template>

                <template #cell-sku="{ row }">
                  <AppTableCodeChip :value="row.sku" max-width="11rem" />
                </template>

                <template #cell-onHand="{ row }">
                  <span class="text-(--text-secondary)">{{ row.onHand }}</span>
                </template>

                <template #cell-reserved="{ row }">
                  <span class="text-(--text-secondary)">{{ row.reserved }}</span>
                </template>
              </AppTable>
            </section>
          </template>
        </template>

        <!-- ===== 次要内容区 ===== -->
        <template #secondary>
          <template v-if="!showRequestErrorState">
            <!-- 最近库存变动 -->
            <section class="space-y-3">
              <h2 class="text-base font-semibold text-(--text-main)">
                {{ t('inventoryDashboard.movements.title') }}
              </h2>
              <AppTable
                :columns="movementColumns"
                :data="data?.recentMovements || []"
                :loading="loading"
                :empty-text="t('inventoryDashboard.movements.empty')"
                no-border
              >
                <template #cell-productName="{ row }">
                  <div>
                    <div class="text-primary max-w-[180px] truncate font-medium" :title="row.productName">
                      {{ row.productName }}
                    </div>
                    <div
                      v-if="row.variantLabel"
                      class="max-w-[180px] truncate text-xs text-(--text-secondary)"
                    >
                      {{ row.variantLabel }}
                    </div>
                  </div>
                </template>

                <template #cell-sku="{ row }">
                  <AppTableCodeChip :value="row.sku" max-width="10rem" />
                </template>

                <template #cell-eventType="{ row }">
                  <AppTableStatusPill
                    :label="getEventLabel(row.eventType)"
                    :variant="getEventVariant(row.eventType)"
                    size="sm"
                  />
                </template>

                <template #cell-quantityDelta="{ row }">
                  <span
                    :class="[
                      'font-mono font-medium',
                      row.quantityDelta > 0 ? 'text-(--color-success)' : row.quantityDelta < 0 ? 'text-(--color-danger)' : 'text-(--text-muted)',
                    ]"
                  >
                    {{ row.quantityDelta > 0 ? '+' : '' }}{{ row.quantityDelta }}
                  </span>
                </template>

                <template #cell-occurredAt="{ row }">
                  <span class="text-(--text-secondary) text-xs">
                    {{ formatTimelineTime(row.occurredAt) }}
                  </span>
                </template>
              </AppTable>
            </section>

            <!-- 出库排行 -->
            <section class="space-y-3">
              <h2 class="text-base font-semibold text-(--text-main)">
                {{ t('inventoryDashboard.topMoving.title') }}
              </h2>
              <AppTable
                :columns="topMovingColumns"
                :data="data?.topMovingItems || []"
                :loading="loading"
                :empty-text="t('inventoryDashboard.topMoving.empty')"
                no-border
              >
                <template #cell-productName="{ row }">
                  <div>
                    <div class="text-primary max-w-[200px] truncate font-medium" :title="row.productName">
                      {{ row.productName }}
                    </div>
                    <div
                      v-if="row.variantLabel"
                      class="max-w-[200px] truncate text-xs text-(--text-secondary)"
                    >
                      {{ row.variantLabel }}
                    </div>
                  </div>
                </template>

                <template #cell-sku="{ row }">
                  <AppTableCodeChip :value="row.sku" max-width="11rem" />
                </template>

                <template #cell-totalOutbound="{ row }">
                  <span class="font-mono font-semibold text-(--text-main)">{{ row.totalOutbound }}</span>
                </template>
              </AppTable>
            </section>
          </template>
        </template>
      </DashboardShell>
    </template>
  </div>
</template>

<script setup>
import { computed, onActivated } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useInventoryDashboard } from '@/composables/useInventoryDashboard';
import { ErrorCode } from '@/utils/error-codes';
import { formatTimelineTime } from '@/utils/formatters';
import AppButton from '@/components/ui/AppButton.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppTableCodeChip from '@/components/ui/AppTableCodeChip.vue';
import AppTableStatusPill from '@/components/ui/AppTableStatusPill.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import StatGroup from '@/design-system/composed/StatGroup.vue';
import DashboardShell from '@/design-system/patterns/DashboardShell.vue';

const { t } = useI18n();
const { data, loading, error, errorCode, init } = useInventoryDashboard();

// ─── 计算属性 ────────────────────────────────────

const showRequestErrorState = computed(
  () => !loading.value && Boolean(error.value) && errorCode.value !== ErrorCode.FORBIDDEN
);

/** 格式化货币 */
const formatCurrency = (value) => {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`;
  }
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

/** 事件类型标签 */
const getEventLabel = (eventType) => {
  return t(`inventoryDashboard.movements.eventType.${eventType}`, eventType);
};

/** 事件类型颜色 */
const getEventVariant = (eventType) => {
  if (eventType.includes('shipment') || eventType.includes('allocated')) return 'warning';
  if (eventType.includes('return') || eventType.includes('restock') || eventType.includes('received') || eventType.includes('arrival')) return 'success';
  if (eventType.includes('cancelled') || eventType.includes('unshipment')) return 'danger';
  return 'info';
};

// ─── 表格列定义 ────────────────────────────────────

const lowStockColumns = computed(() => [
  { key: 'productName', label: t('inventoryDashboard.lowStock.table.product'), width: '220px', minWidth: '180px' },
  { key: 'sku', label: t('inventoryDashboard.lowStock.table.sku'), kind: 'identifier', width: '140px' },
  { key: 'available', label: t('inventoryDashboard.lowStock.table.available'), kind: 'numeric', align: 'center' },
  { key: 'onHand', label: t('inventoryDashboard.lowStock.table.onHand'), kind: 'numeric', align: 'center', headerClass: 'hidden md:table-cell', cellClass: 'hidden md:table-cell' },
  { key: 'reserved', label: t('inventoryDashboard.lowStock.table.reserved'), kind: 'numeric', align: 'center', headerClass: 'hidden md:table-cell', cellClass: 'hidden md:table-cell' },
  { key: 'alertThreshold', label: t('inventoryDashboard.lowStock.table.threshold'), kind: 'numeric', align: 'center' },
]);

const zeroStockColumns = computed(() => [
  { key: 'productName', label: t('inventoryDashboard.zeroStock.table.product'), width: '220px', minWidth: '180px' },
  { key: 'sku', label: t('inventoryDashboard.zeroStock.table.sku'), kind: 'identifier', width: '140px' },
  { key: 'onHand', label: t('inventoryDashboard.zeroStock.table.onHand'), kind: 'numeric', align: 'center' },
  { key: 'reserved', label: t('inventoryDashboard.zeroStock.table.reserved'), kind: 'numeric', align: 'center' },
]);

const movementColumns = computed(() => [
  { key: 'productName', label: t('inventoryDashboard.movements.table.product'), width: '200px', minWidth: '160px' },
  { key: 'sku', label: t('inventoryDashboard.movements.table.sku'), kind: 'identifier', width: '120px', headerClass: 'hidden md:table-cell', cellClass: 'hidden md:table-cell' },
  { key: 'eventType', label: t('inventoryDashboard.movements.table.type'), width: '140px' },
  { key: 'quantityDelta', label: t('inventoryDashboard.movements.table.delta'), kind: 'numeric', align: 'center', width: '100px' },
  { key: 'occurredAt', label: t('inventoryDashboard.movements.table.time'), width: '100px' },
]);

const topMovingColumns = computed(() => [
  { key: 'productName', label: t('inventoryDashboard.topMoving.table.product'), width: '220px', minWidth: '180px' },
  { key: 'sku', label: t('inventoryDashboard.topMoving.table.sku'), kind: 'identifier', width: '140px' },
  { key: 'totalOutbound', label: t('inventoryDashboard.topMoving.table.outbound'), kind: 'numeric', align: 'center' },
]);

// ─── 生命周期 ────────────────────────────────────

onActivated(() => {
  init();
});
</script>

<style scoped>
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}
.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, var(--bg-card) 50%, transparent 100%);
  animation: shimmer 1.8s infinite;
}
[data-theme='light'] .skeleton-shimmer::after {
  background: linear-gradient(90deg, transparent 0%, var(--bg-muted) 50%, transparent 100%);
}
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer::after {
    animation: none;
    display: none;
  }
}
</style>
