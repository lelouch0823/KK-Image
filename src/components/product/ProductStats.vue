<template>
  <div class="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
    <MetricTile
      :label="t('product.stats.total_products')"
      :value="totalFormatted"
      icon="cube"
      tone="info"
      :meta="t('product.stats.active_catalog')"
    />

    <MetricTile
      :label="t('product.stats.low_stock')"
      :value="lowStockCount"
      icon="exclamation-triangle"
      tone="warning"
      :meta="t('product.stats.needs_attention')"
    />

    <MetricTile
      :label="t('product.stats.total_value')"
      icon="currency-dollar"
      tone="success"
      :meta="t('product.stats.cost_basis')"
    >
      <template #value>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-bold text-(--text-muted)">¥</span>
          <span>{{ valueFormatted }}</span>
        </div>
      </template>
    </MetricTile>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useI18n } from '@/composables/useI18n';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import { formatAmount, formatCurrencyCompact } from '@/utils/formatters';

const props = defineProps({
  filters: {
    type: Object,
    default: () => ({}),
  },
  active: {
    type: Boolean,
    default: true,
  },
});

const { t } = useI18n();
const { products, pagination, loadProducts } = useProducts();
const statsProducts = ref([]);
const statsTotal = ref(0);
let statsRequestId = 0;

const STATS_PAGE_LIMIT = 100;
const resolveAlertThreshold = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 10;
};

const resetStatsState = () => {
  statsProducts.value = [];
  statsTotal.value = 0;
};

const buildStatsQuery = (page) => ({
  search: String(props.filters?.search || ''),
  status: String(props.filters?.status || ''),
  brand: String(props.filters?.brand || ''),
  category: String(props.filters?.category || ''),
  hasStock: String(props.filters?.hasStock || ''),
  sortBy: String(props.filters?.sortBy || ''),
  sortOrder: String(props.filters?.sortOrder || ''),
  page,
  limit: STATS_PAGE_LIMIT,
});

const loadAllStatsProducts = async (requestId) => {
  const collected = [];
  let page = 1;
  let nextTotal = 0;

  while (true) {
    const ok = await loadProducts(buildStatsQuery(page), true);
    if (requestId !== statsRequestId) return;
    if (!ok) {
      resetStatsState();
      return;
    }

    const pageItems = Array.isArray(products.value) ? [...products.value] : [];
    collected.push(...pageItems);
    nextTotal = Number(pagination.total || 0);
    const totalPages = Math.max(1, Number(pagination.totalPages || 1));

    if (page >= totalPages || (nextTotal > 0 && collected.length >= nextTotal)) {
      break;
    }

    page += 1;
  }

  if (requestId !== statsRequestId) return;
  statsProducts.value = collected;
  statsTotal.value = nextTotal > 0 ? nextTotal : collected.length;
};

const totalFormatted = computed(() => {
  return formatAmount(statsTotal.value || 0);
});

const lowStockCount = computed(() => {
  return statsProducts.value.filter((p) => {
    const quantity = Number(p.available_quantity ?? p.available ?? p.stock_quantity ?? 0);
    return quantity < resolveAlertThreshold(p.alert_threshold);
  }).length;
});

const valueFormatted = computed(() => {
  const total = statsProducts.value.reduce(
    (acc, p) => acc + (p.cost_price || 0) * (p.stock_quantity || 0),
    0
  );
  return formatCurrencyCompact(total);
});

watch(
  () => [
    props.active,
    props.filters?.search,
    props.filters?.status,
    props.filters?.brand,
    props.filters?.category,
    props.filters?.hasStock,
    props.filters?.sortBy,
    props.filters?.sortOrder,
  ],
  ([active]) => {
    const requestId = ++statsRequestId;
    if (!active) return;
    void loadAllStatsProducts(requestId);
  },
  { immediate: true }
);
</script>
