<template>
  <div class="flex-shrink-0 border-b border-[var(--border-color)] p-3 sm:p-4">
    <!-- Header with Create Button -->
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-base font-semibold text-[var(--text-main)] sm:text-lg">{{ t('order.manage.title') }}</h2>
        <p class="hidden text-sm text-[var(--text-secondary)] sm:block">{{ t('order.manage.subtitle') }}</p>
      </div>

      <!-- Desktop: Create + Export buttons -->
      <div class="hidden shrink-0 items-center gap-2 sm:flex">
        <button
          v-if="showCreate"
          class="bg-primary shadow-primary/20 flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-hover active:scale-95 dark:text-gray-900"
          @click="$emit('create')"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ t('order.manage.create') }}
        </button>

        <button
          :disabled="exporting"
          class="flex h-9 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-sm font-medium text-[var(--text-main)] transition-all hover:bg-[var(--bg-card-hover)] active:scale-95 disabled:opacity-50"
          @click="$emit('export')"
        >
          <svg v-if="exporting" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <svg v-else class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {{ exporting ? t('order.manage.exporting') : t('order.manage.export') }}
        </button>
      </div>

      <!-- Mobile: Icon buttons only -->
      <div class="flex shrink-0 items-center gap-1 sm:hidden">
        <button
          v-if="showCreate"
          class="bg-primary flex size-9 items-center justify-center rounded-lg text-white shadow-sm transition-all active:scale-95 dark:text-gray-900"
          :title="t('order.manage.create')"
          @click="$emit('create')"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        
        <!-- Mobile Stats Button -->
        <button
          class="flex size-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--color-primary)] transition-all active:scale-95"
          :title="t('dashboard.stats')"
          @click="$emit('show-stats')"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>

        <button
          :disabled="exporting"
          class="flex size-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-main)] transition-all active:scale-95 disabled:opacity-50"
          :title="t('order.manage.export')"
          @click="$emit('export')"
        >
          <svg v-if="exporting" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <svg v-else class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Filters Row -->
    <div class="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3">
      <!-- 销售筛选 -->
      <div class="min-w-[72px] max-w-[100px] sm:w-36">
        <Select
          :model-value="filters.salesperson"
          :options="salespersonOptions"
          :placeholder="isMobile ? t('order.manage.salesShort') : t('order.manage.allSalespersons')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, salesperson: $event })"
        />
      </div>

      <!-- 状态筛选 -->
      <div class="min-w-[72px] max-w-[100px] sm:w-32">
        <Select
          :model-value="filters.status"
          :options="statusOptions"
          :placeholder="isMobile ? t('order.manage.statusShort') : t('order.manage.allStatuses')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, status: $event })"
        />
      </div>

      <!-- 搜索 -->
      <div class="min-w-0 flex-1">
        <SearchInput
          :model-value="filters.search"
          :placeholder="t('common.searchPlaceholder')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, search: $event })"
          @search="$emit('search')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
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

defineEmits(['update:filters', 'search', 'export', 'create', 'show-stats']);

const { t } = useI18n();

// 移动端检测 (sm breakpoint = 640px)
const isMobile = ref(false);
let mediaQuery = null;

const updateMobile = (e) => {
  isMobile.value = !e.matches;
};

onMounted(() => {
  mediaQuery = window.matchMedia('(min-width: 640px)');
  isMobile.value = !mediaQuery.matches;
  mediaQuery.addEventListener('change', updateMobile);
});

onUnmounted(() => {
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', updateMobile);
  }
});

const salespersonOptions = computed(() => [
  { 
    label: isMobile.value ? t('order.manage.salesShort') : t('order.manage.allSalespersons'), 
    value: '' 
  },
  ...props.salespersons.map(s => ({ label: s.name, value: s.id }))
]);

const statusOptions = computed(() => [
  { 
    label: isMobile.value ? t('order.manage.statusShort') : t('order.manage.allStatuses'), 
    value: '' 
  },
  ...props.statuses.map(s => ({ label: t(`order.statuses.${s}`), value: s }))
]);
</script>

<style scoped>
/* 隐藏横向滚动条 */
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
