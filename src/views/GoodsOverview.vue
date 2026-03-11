<template>
  <div class="space-y-6">
    <div v-if="errorCode === 'FORBIDDEN'" class="rounded-xl border border-(--border-color) bg-(--bg-card) p-8">
      <PermissionDeniedState
        title="订货总览权限不足"
        :description="error || '当前账号没有订货总览读取权限，请联系管理员分配 goods:read。'"
        home-to="/admin/forbidden"
        home-text="查看权限说明"
        @retry="init"
      />
    </div>
    <template v-else>
    <ManagementListShell
      :title="t('sidebar.goodsOverview')"
      :description="t('goodsOverview.subtitle')"
    >
      <template #actions>
        <AppButton
          variant="secondary"
          :text="t('goodsOverview.export')"
          @click="exportCSV"
        >
          <template #icon-left>
            <AppIcon name="document-arrow-down" class="size-4" />
          </template>
        </AppButton>
      </template>

      <template #filters>
          <FilterSelect
            v-model="filters.brand"
            :options="brandOptions"
            :placeholder="t('goodsOverview.filter.allBrands')"
          />

          <FilterSelect
            v-model="filters.category"
            :options="categoryOptions"
            :placeholder="t('goodsOverview.filter.allCategories')"
          />

          <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-(--text-secondary)">
            <input
              v-model="filters.shortageOnly"
              type="checkbox"
              class="text-primary size-4 rounded border-(--border-color) focus:ring-primary"
            />
            {{ t('goodsOverview.filter.shortageOnly') }}
          </label>

          <div class="ml-auto">
            <FilterSelect
              v-model="filters.sort"
              :options="sortOptions"
              :placeholder="t('goodsOverview.sort.shortage')"
            />
          </div>
      </template>

      <template #content>

    <!-- ===== 管道概览卡片：骨架屏 or 真实数据 ===== -->
    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <template v-if="loading && !summary">
        <!-- 骨架卡片 x4 -->
        <div
          v-for="i in 4" :key="'sk-card-' + i"
          class="relative overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-lg sm:p-5"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 space-y-3">
              <div class="skeleton-shimmer h-3.5 w-16 rounded bg-(--bg-muted)" />
              <div class="skeleton-shimmer h-8 w-12 rounded bg-(--bg-muted)" />
            </div>
            <div class="skeleton-shimmer size-9 rounded-xl bg-(--bg-muted) sm:size-10" />
          </div>
          <div class="mt-3 flex items-center gap-2">
            <div class="skeleton-shimmer h-3 w-20 rounded bg-(--bg-muted)" />
            <div class="skeleton-shimmer h-3 w-12 rounded bg-(--bg-muted)" />
          </div>
        </div>
      </template>

      <template v-else-if="summary">
        <MetricTile
          :label="t('goodsOverview.pipeline.confirmed')"
          :value="summary.byStatus.confirmed.products"
          icon="clipboard-document-check"
          tone="warning"
        >
          <template #meta>
            <span>{{ t('goodsOverview.orderCount', { count: summary.byStatus.confirmed.count }) }}</span>
            <span class="text-(--text-muted)">·</span>
            <span>{{ summary.byStatus.confirmed.qty }} {{ t('goodsOverview.unit') }}</span>
          </template>
        </MetricTile>

        <MetricTile
          :label="t('goodsOverview.pipeline.production')"
          :value="summary.byStatus.production.products"
          icon="beaker"
          tone="info"
        >
          <template #meta>
            <span>{{ t('goodsOverview.orderCount', { count: summary.byStatus.production.count }) }}</span>
            <span class="text-(--text-muted)">·</span>
            <span>{{ summary.byStatus.production.qty }} {{ t('goodsOverview.unit') }}</span>
          </template>
        </MetricTile>

        <MetricTile
          :label="t('goodsOverview.pipeline.shipping')"
          :value="summary.byStatus.shipping.products"
          icon="building-storefront"
          tone="purple"
        >
          <template #meta>
            <span>{{ t('goodsOverview.orderCount', { count: summary.byStatus.shipping.count }) }}</span>
            <span class="text-(--text-muted)">·</span>
            <span>{{ summary.byStatus.shipping.qty }} {{ t('goodsOverview.unit') }}</span>
          </template>
        </MetricTile>

        <MetricTile
          :label="t('goodsOverview.pipeline.arrived')"
          :value="summary.byStatus.arrived.products"
          icon="check"
          tone="success"
        >
          <template #meta>
            <span>{{ t('goodsOverview.orderCount', { count: summary.byStatus.arrived.count }) }}</span>
            <span class="text-(--text-muted)">·</span>
            <span>{{ summary.byStatus.arrived.qty }} {{ t('goodsOverview.unit') }}</span>
          </template>
        </MetricTile>
      </template>
    </div>

    <!-- ===== 总需求 + 缺货摘要：骨架屏 or 真实数据 ===== -->
    <SummaryStrip v-if="loading && !summary">
      <div class="skeleton-shimmer h-5 w-28 rounded bg-(--bg-muted)" />
      <div class="h-5 w-px bg-(--border-color)"></div>
      <div class="skeleton-shimmer h-5 w-24 rounded bg-(--bg-muted)" />
      <div class="h-5 w-px bg-(--border-color)"></div>
      <div class="skeleton-shimmer h-5 w-24 rounded bg-(--bg-muted)" />
    </SummaryStrip>
    <SummaryStrip v-else-if="summary">
      <div class="flex items-center gap-2">
        <span class="text-secondary text-sm">{{ t('goodsOverview.summary.totalProducts') }}:</span>
        <span class="text-primary font-semibold">{{ summary.totalProducts }}</span>
      </div>
      <div class="h-5 w-px bg-(--border-color)"></div>
      <div class="flex items-center gap-2">
        <span class="text-secondary text-sm">{{ t('goodsOverview.summary.totalDemand') }}:</span>
        <span class="text-primary font-semibold">{{ summary.totalDemand }}</span>
      </div>
      <div class="h-5 w-px bg-(--border-color)"></div>
      <div class="flex items-center gap-2">
        <span class="text-secondary text-sm">{{ t('goodsOverview.summary.shortageCount') }}:</span>
        <span class="text-danger font-semibold">{{ summary.shortageCount }}</span>
      </div>
    </SummaryStrip>



    <!-- ===== 数据表格：AppTable ===== -->
    <div class="overflow-hidden rounded-xl border border-(--border-color) shadow-sm">
      <AppTable
        :columns="columns"
        :data="items"
        :loading="loading"
        :empty-text="t('goodsOverview.empty')"
      >
        <!-- 复选框列头 -->
        <template #header-selection>
          <input 
            type="checkbox" 
            :checked="isAllSelected" 
            class="text-primary size-4 cursor-pointer rounded border-(--border-color) focus:ring-primary" 
            @change="toggleSelectAll" 
          />
        </template>

        <!-- 复选框列内容 -->
        <template #cell-selection="{ row: item }">
          <input 
            type="checkbox" 
            :checked="isSelected(item)" 
            class="text-primary size-4 cursor-pointer rounded border-(--border-color) focus:ring-primary" 
            @change="toggleSelect(item)" 
          />
        </template>

        <!-- 商品名称列 -->
        <template #cell-name="{ row: item }">
          <div class="flex items-center gap-2.5">
            <div class="size-8 shrink-0 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-muted)">
              <AppImage v-if="item.images?.[0]" :src="'/file/' + item.images[0]" class="size-full" />
              <div v-else class="flex size-full items-center justify-center text-(--text-muted)">
                <AppIcon name="photo" class="size-4" />
              </div>
            </div>
            <div>
              <div class="text-primary max-w-[150px] truncate font-medium" :title="item.name">{{ item.name }}</div>
              <div v-if="item.variantLabel" class="max-w-[180px] truncate text-xs text-(--text-secondary)" :title="item.variantLabel">
                {{ item.variantLabel }}
              </div>
            </div>
          </div>
        </template>

        <!-- SKU -->
        <template #cell-sku="{ row: item }">
          <code class="rounded bg-(--bg-muted) px-1.5 py-0.5 text-xs text-(--text-secondary)">{{ item.sku }}</code>
        </template>

        <!-- 品牌 (响应式处理) -->
        <template #cell-brand="{ row: item }">
          <span class="text-(--text-secondary)">{{ item.brand || '-' }}</span>
        </template>

        <!-- 库存 -->
        <template #cell-stockQuantity="{ row: item }">
          <span class="font-medium text-(--text-main)">{{ item.stockQuantity }}</span>
        </template>

        <!-- 待订货 -->
        <template #cell-confirmedQty="{ row: item }">
          <span v-if="item.confirmedQty > 0" class="text-warning font-medium">{{ item.confirmedQty }}</span>
          <span v-else class="text-(--text-muted)">-</span>
        </template>

        <!-- 生产中 -->
        <template #cell-productionQty="{ row: item }">
          <span v-if="item.productionQty > 0" class="text-info font-medium">{{ item.productionQty }}</span>
          <span v-else class="text-(--text-muted)">-</span>
        </template>

        <!-- 运输中 -->
        <template #cell-shippingQty="{ row: item }">
          <span v-if="item.shippingQty > 0" class="font-medium text-(--color-purple)">{{ item.shippingQty }}</span>
          <span v-else class="text-(--text-muted)">-</span>
        </template>

        <!-- 已到货 -->
        <template #cell-arrivedQty="{ row: item }">
          <span v-if="item.arrivedQty > 0" class="text-success font-medium">{{ item.arrivedQty }}</span>
          <span v-else class="text-(--text-muted)">-</span>
        </template>

        <!-- 总需求 -->
        <template #cell-totalDemand="{ row: item }">
          <span class="font-semibold text-(--text-main)">{{ item.totalDemand }}</span>
        </template>

        <!-- 缺口 -->
        <template #cell-shortage="{ row: item }">
          <span
            :class="[
              'font-bold',
              item.shortage > 0 ? 'text-danger' : 'text-(--text-muted)',
            ]"
          >
            {{ item.shortage > 0 ? '+' + item.shortage : item.shortage }}
          </span>
        </template>

        <!-- 入货成本 -->
        <template #cell-avgUnitCost="{ row: item }">
          <span class="font-[Outfit] text-(--text-secondary)">
            {{ item.avgUnitCost > 0 ? '¥' + item.avgUnitCost.toFixed(2) : '—' }}
          </span>
        </template>

        <!-- 运费分摊 -->
        <template #cell-avgFreight="{ row: item }">
          <span class="font-[Outfit] text-(--text-secondary)">
            {{ item.avgFreight > 0 ? '¥' + item.avgFreight.toFixed(2) : '—' }}
          </span>
        </template>

        <!-- 到岸成本 -->
        <template #cell-landedCost="{ row: item }">
          <span v-if="item.landedCost > 0" class="font-[Outfit] font-semibold text-(--text-main)">¥{{ item.landedCost.toFixed(2) }}</span>
          <span v-else class="text-(--text-muted)">—</span>
        </template>

        <!-- 状态标签 -->
        <template #cell-status="{ row: item }">
          <StatusBadge
            v-if="item.shortage > 0"
            status="danger"
            :text="t('goodsOverview.status.shortage')"
          />
          <StatusBadge
            v-else-if="item.stockQuantity < item.alertThreshold"
            status="warning"
            :text="t('goodsOverview.status.warning')"
          />
          <StatusBadge
            v-else
            status="success"
            :text="t('goodsOverview.status.sufficient')"
          />
        </template>
      </AppTable>
    </div>

    <!-- ===== 浮动操作栏 ===== -->
    <FloatingSelectionBar :visible="selectedItems.length > 0">
      <template #summary>
        <span class="text-sm font-medium text-(--text-main)">
          {{ t('goodsOverview.batch.selected', { count: selectedItems.length }) }}
        </span>
      </template>
      <template #default>
        <button
          class="bg-primary flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isCreatingPO"
          @click="handleCreatePO"
        >
          <AppIcon v-if="isCreatingPO" name="spinner" class="size-4 animate-spin text-white" />
          {{ t('goodsOverview.batch.createPO') }}
        </button>
        <button
          class="cursor-pointer rounded-lg px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
          :disabled="isCreatingPO"
          @click="clearSelection"
        >
          {{ t('goodsOverview.batch.deselectAll') }}
        </button>
      </template>
    </FloatingSelectionBar>
      </template>
    </ManagementListShell>
    </template>
  </div>
</template>

<script setup>
import { computed, onActivated, onDeactivated, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAI } from '@/composables/useAI';
import { useGoodsOverview } from '@/composables/useGoodsOverview';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import FilterSelect from '@/design-system/composed/FilterSelect.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import SummaryStrip from '@/design-system/composed/SummaryStrip.vue';
import FloatingSelectionBar from '@/design-system/composed/FloatingSelectionBar.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';


const { t } = useI18n();
const { addToast } = useToast();
const { setContext } = useAI();
const router = useRouter();
const {
  items, summary, loading, error, errorCode, filters, availableFilters,
  selectedItems, isAllSelected, toggleSelect, toggleSelectAll, isSelected, clearSelection,
  exportCSV, createPOFromSelected, isCreatingPO, init,
} = useGoodsOverview();

const columns = computed(() => [
  { key: 'selection', label: '', width: '40px' },
  { key: 'name', label: t('goodsOverview.table.name') },
  { key: 'sku', label: t('goodsOverview.table.sku') },
  { key: 'brand', label: t('goodsOverview.table.brand'), class: 'hidden md:table-cell' },
  { key: 'stockQuantity', label: t('goodsOverview.table.stock'), align: 'center' },
  { key: 'confirmedQty', label: t('goodsOverview.pipeline.confirmed'), align: 'center', class: 'text-warning' },
  { key: 'productionQty', label: t('goodsOverview.pipeline.production'), align: 'center', class: 'text-info' },
  { key: 'shippingQty', label: t('goodsOverview.pipeline.shipping'), align: 'center', class: 'text-(--color-purple)' },
  { key: 'arrivedQty', label: t('goodsOverview.pipeline.arrived'), align: 'center', class: 'text-success' },
  { key: 'totalDemand', label: t('goodsOverview.table.totalDemand'), align: 'center' },
  { key: 'shortage', label: t('goodsOverview.table.shortage'), align: 'center' },
  { key: 'avgUnitCost', label: t('goodsOverview.table.unitCost'), align: 'center', class: 'hidden lg:table-cell' },
  { key: 'avgFreight', label: t('goodsOverview.table.freight'), align: 'center', class: 'hidden lg:table-cell' },
  { key: 'landedCost', label: t('goodsOverview.table.landedCost'), align: 'center', class: 'hidden lg:table-cell' },
  { key: 'status', label: t('goodsOverview.table.status'), align: 'center' },
]);

const brandOptions = computed(() => [
  { value: '', label: t('goodsOverview.filter.allBrands') },
  ...availableFilters.brands.map((brand) => ({ value: brand, label: brand })),
]);

const categoryOptions = computed(() => [
  { value: '', label: t('goodsOverview.filter.allCategories') },
  ...availableFilters.categories.map((category) => ({ value: category, label: category })),
]);

const sortOptions = computed(() => [
  { value: 'shortage', label: t('goodsOverview.sort.shortage') },
  { value: 'demand', label: t('goodsOverview.sort.demand') },
  { value: 'name', label: t('goodsOverview.sort.name') },
  { value: 'cost', label: t('goodsOverview.sort.cost') },
]);

const handleCreatePO = async () => {
  if (isCreatingPO.value) return;
  const firstSelectedVariantId = selectedItems.value[0]?.variantId || selectedItems.value[0]?.id || null;
  const result = await createPOFromSelected();
  if (result.success) {
    addToast({ type: 'success', message: t('goodsOverview.toast.poCreated') });
    const query = { id: result.data.id };
    if (firstSelectedVariantId) query.variantId = firstSelectedVariantId;
    router.push({ path: '/purchase-orders', query });
  } else {
    addToast({ type: 'error', message: result.error || '生成采购单失败' });
  }
};

// 使用 onActivated 代替 onMounted，确保在 keep-alive 环境下
// 每次导航进入该页面时都会重新拉取最新数据
onActivated(() => {
  init();
});

watch(selectedItems, (items) => {
  const first = (items || [])[0] || null;
  if (first) {
    setContext({
      selectedId: first.variantId || first.id || null,
      selectedType: 'variant',
    });
    return;
  }
  setContext({
    selectedId: null,
    selectedType: null,
  });
});

onDeactivated(() => {
  setContext({
    selectedId: null,
    selectedType: null,
  });
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
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 50%, transparent 100%);
  animation: shimmer 1.8s infinite;
}
[data-theme='light'] .skeleton-shimmer::after {
  background: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.04) 50%, transparent 100%);
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
