<template>
  <div
    class="flex flex-shrink-0 flex-col justify-between gap-4 border-b border-[var(--border-color)] p-4 sm:flex-row sm:items-center"
  >
    <div>
      <h2 class="text-lg font-semibold text-[var(--text-main)]">{{ t('order.manage.title') }}</h2>
      <p class="mt-1 text-sm text-[var(--text-secondary)]">{{ t('order.manage.subtitle') }}</p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <!-- Create Button -->
      <button
        v-if="showCreate"
        class="bg-primary shadow-primary/20 flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-hover active:scale-95 dark:text-gray-900"
        @click="$emit('create')"
      >
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('order.manage.create') || '新建订单' }}
      </button>

      <!-- 销售筛选 -->
      <div class="w-40">
        <Select
          :model-value="filters.salesperson"
          :options="salespersonOptions"
          :placeholder="t('order.manage.allSalespersons')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, salesperson: $event })"
        />
      </div>

      <!-- 状态筛选 -->
      <div class="w-40">
        <Select
          :model-value="filters.status"
          :options="statusOptions"
          :placeholder="t('order.manage.allStatuses')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, status: $event })"
        />
      </div>

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
        class="flex h-9 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-[var(--color-primary)]/10 shadow-sm transition-all hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:opacity-50 dark:text-gray-900"
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
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import SearchInput from '@/components/ui/SearchInput.vue';
import Select from '@/components/ui/Select.vue';

const props = defineProps({
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
  showCreate: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['update:filters', 'search', 'export', 'create']);

const { t } = useI18n();

const salespersonOptions = computed(() => [
  { label: t('order.manage.allSalespersons'), value: '' },
  ...props.salespersons.map(s => ({ label: s.name, value: s.id }))
]);

const statusOptions = computed(() => [
  { label: t('order.manage.allStatuses'), value: '' },
  ...props.statuses.map(s => ({ label: t(`order.statuses.${s}`), value: s }))
]);
</script>
