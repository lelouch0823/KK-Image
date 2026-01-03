<template>
  <div
    class="flex flex-shrink-0 flex-col justify-between gap-4 border-b border-[var(--border-color)] p-4 sm:flex-row sm:items-center"
  >
    <div>
      <h2 class="text-lg font-semibold text-[var(--text-main)]">{{ t('order.manage.title') }}</h2>
      <p class="mt-1 text-sm text-[var(--text-secondary)]">{{ t('order.manage.subtitle') }}</p>
    </div>

    <div class="flex items-center gap-3">
      <!-- 销售筛选 -->
      <select
        :value="filters.salesperson"
        class="h-9 rounded-lg border-[var(--border-color)] bg-[var(--bg-muted)] px-3 text-sm text-[var(--text-main)] transition-all outline-none focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
        @change="$emit('update:filters', { ...filters, salesperson: $event.target.value })"
      >
        <option value="">{{ t('order.manage.allSalespersons') }}</option>
        <option v-for="s in salespersons" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>

      <!-- 状态筛选 -->
      <select
        :value="filters.status"
        class="h-9 rounded-lg border-[var(--border-color)] bg-[var(--bg-muted)] px-3 text-sm text-[var(--text-main)] transition-all outline-none focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
        @change="$emit('update:filters', { ...filters, status: $event.target.value })"
      >
        <option value="">{{ t('order.manage.allStatuses') }}</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ t(`order.statuses.${s}`) }}</option>
      </select>

      <!-- 搜索 -->
      <SearchInput
        :model-value="filters.search"
        :placeholder="t('common.searchPlaceholder')"
        class="w-full sm:w-48"
        @update:model-value="$emit('update:filters', { ...filters, search: $event })"
        @search="$emit('search')"
      />

      <!-- 导出按钮 -->
      <button
        :disabled="exporting"
        class="flex h-9 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-[var(--color-primary)]/10 shadow-sm transition-all hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:opacity-50"
        @click="$emit('export')"
      >
        <svg v-if="exporting" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <svg v-else class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {{ exporting ? t('order.manage.exporting') : t('order.manage.export') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import SearchInput from '@/components/ui/SearchInput.vue';

defineProps({
  filters: {
    type: Object,
    required: true,
    // { salesperson: '', status: '', search: '' }
  },
  salespersons: {
    type: Array,
    default: () => [],
  },
  statuses: {
    type: Array,
    default: () => [],
  },
  exporting: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['update:filters', 'search', 'export']);

const { t } = useI18n();
</script>
