<template>
  <section
    data-testid="purchase-order-console-banner"
    class="relative overflow-hidden rounded-[1.75rem] border border-(--border-color)/60 bg-(--bg-card) p-4 shadow-card sm:p-5"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.06),transparent_24%)]"
    ></div>
    <div class="relative space-y-4">
      <div class="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div>
            <h2 class="text-lg font-semibold text-(--text-main)">
              {{ title }}
            </h2>
            <p class="mt-1 max-w-2xl text-sm leading-6 text-(--text-secondary)">
              {{ description }}
            </p>
          </div>
        </div>
        <div class="flex items-center lg:justify-end">
          <span
            class="inline-flex items-center rounded-full border border-(--border-color)/70 bg-(--bg-card)/80 px-3 py-1 text-xs font-medium text-(--text-secondary)"
          >
            {{ totalLabel }}
          </span>
        </div>
      </div>

      <div
        data-testid="purchase-order-overview-strip"
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6"
      >
        <template v-if="loading && !stats">
          <div
            v-for="i in 6"
            :key="'sk-card-' + i"
            class="relative overflow-hidden rounded-2xl border border-(--border-color)/60 bg-(--bg-card)/90 p-4 shadow-none backdrop-blur sm:p-5"
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

        <template v-else-if="stats">
          <MetricTile
            v-for="card in statCards"
            :key="card.key"
            :label="card.label"
            :value="card.count"
            :icon="card.icon"
            :tone="card.tone"
            :active="activeStatus === card.key"
            flat
            clickable
            @click="$emit('toggle-status-filter', card.key)"
          />
        </template>
      </div>

      <div v-if="consoleSignals.length > 0" class="grid gap-3 md:grid-cols-3">
        <article
          v-for="signal in consoleSignals"
          :key="signal.key"
          class="rounded-[1.1rem] border border-(--border-color)/55 bg-(--bg-card)/92 p-4"
        >
          <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
            {{ signal.label }}
          </p>
          <div class="mt-2">
            <div>
              <div class="font-mono text-2xl font-semibold text-(--text-main) tabular-nums">
                {{ signal.value }}
              </div>
              <p class="mt-1 text-xs leading-5 text-(--text-secondary)">
                {{ signal.hint }}
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  total: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  stats: {
    type: Object,
    default: null,
  },
  statCards: {
    type: Array,
    default: () => [],
  },
  consoleSignals: {
    type: Array,
    default: () => [],
  },
  activeStatus: {
    type: String,
    default: '',
  },
});

defineEmits(['toggle-status-filter']);

const { t } = useI18n();

const totalLabel = computed(() => t('purchaseOrder.pagination.total', { count: props.total }));
</script>
