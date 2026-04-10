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

const STATS_PAGE_LIMIT = 100;

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

const loadAllStatsProducts = async () => {
  const collected = [];
  let page = 1;

  while (true) {
    const ok = await loadProducts(buildStatsQuery(page), true);
    if (!ok) return;

    const pageItems = Array.isArray(products.value) ? [...products.value] : [];
    collected.push(...pageItems);
    statsTotal.value = Number(pagination.total || 0);
    const totalPages = Math.max(1, Number(pagination.totalPages || 1));

    if (page >= totalPages || (statsTotal.value > 0 && collected.length >= statsTotal.value)) {
      break;
    }

    page += 1;
  }

  statsProducts.value = collected;
  if (statsTotal.value <= 0) {
    statsTotal.value = collected.length;
  }
};

const totalFormatted = computed(() => {
    return Number(statsTotal.value || 0).toLocaleString();
});

const lowStockCount = computed(() => {
    return statsProducts.value.filter((p) => (p.stock_quantity || 0) < (p.alert_threshold || 10)).length;
});

const valueFormatted = computed(() => {
    const total = statsProducts.value.reduce((acc, p) => acc + (p.cost_price || 0) * (p.stock_quantity || 0), 0);
    return total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
    if (!active) return;
    void loadAllStatsProducts();
  },
  { immediate: true }
);
</script>
