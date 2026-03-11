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
import { computed } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useI18n } from '@/composables/useI18n';
import MetricTile from '@/design-system/composed/MetricTile.vue';

const { t } = useI18n();
const { products, pagination } = useProducts();

const totalFormatted = computed(() => {
    return pagination.total.toLocaleString();
});

const lowStockCount = computed(() => {
    return products.value.filter(p => (p.stock_quantity || 0) < (p.alert_threshold || 10)).length;
});

const valueFormatted = computed(() => {
    const total = products.value.reduce((acc, p) => acc + (p.cost_price || 0) * (p.stock_quantity || 0), 0);
    return total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
});
</script>
