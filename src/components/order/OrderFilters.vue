<template>
  <AppFilterBar>
    <template #actions>
      <!-- Mobile: Icon buttons only -->
      <div class="flex shrink-0 items-center gap-1 lg:hidden">
        <button
          v-if="showCreate"
          class="bg-primary flex size-9 items-center justify-center rounded-lg text-(--text-inverse) shadow-sm transition-all active:scale-95"
          :title="t('order.manage.create')"
          @click="$emit('create')"
        >
          <AppIcon name="plus" class="size-5" />
        </button>
        
        <!-- Mobile Stats Button -->
        <button
          class="text-primary flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-card) transition-all active:scale-95"
          :title="t('dashboard.stats')"
          @click="$emit('show-stats')"
        >
          <AppIcon name="chart-bar" class="size-5" />
        </button>

        <button
          :disabled="exporting"
          class="flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-card) text-(--text-main) transition-all active:scale-95 disabled:opacity-50"
          :title="t('order.manage.export')"
          @click="$emit('export')"
        >
          <AppIcon v-if="exporting" name="spinner" class="size-4 animate-spin" />
          <AppIcon v-else name="document-arrow-down" class="size-4" />
        </button>
      </div>
    </template>

    <template #filters>
      <!-- 销售筛选 -->
      <div class="w-24 sm:w-36 lg:w-28 xl:w-36">
        <Select
          :model-value="filters.salesperson"
          :options="salespersonOptions"
          :placeholder="isMobile ? t('order.manage.salesShort') : t('order.manage.allSalespersons')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, salesperson: $event })"
        />
      </div>

      <!-- 状态筛选 -->
      <div class="w-24 sm:w-32 lg:w-24 xl:w-32">
        <Select
          :model-value="filters.status"
          :options="statusOptions"
          :placeholder="isMobile ? t('order.manage.statusShort') : t('order.manage.allStatuses')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, status: $event })"
        />
      </div>

      <!-- 采购状态筛选 -->
      <div class="w-28 sm:w-40 lg:w-32 xl:w-40">
        <Select
          :model-value="filters.procurementStatus"
          :options="procurementStatusOptions"
          :placeholder="isMobile ? t('order.manage.procurementStatusShort') : t('order.manage.allProcurementStatuses')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, procurementStatus: $event })"
        />
      </div>

      <div class="w-28 sm:w-40 lg:w-32 xl:w-40">
        <Select
          :model-value="filters.deliveryStatus"
          :options="deliveryStatusOptions"
          :placeholder="isMobile ? t('order.manage.deliveryStatusShort') : t('order.manage.allDeliveryStatuses')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, deliveryStatus: $event })"
        />
      </div>

      <!-- 搜索 -->
      <div class="min-w-0 basis-full lg:min-w-[12rem] lg:flex-1">
        <SearchInput
          :model-value="filters.search"
          :placeholder="t('common.searchPlaceholder')"
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, search: $event })"
          @search="$emit('search')"
        />
      </div>

      <!-- Desktop: inline actions next to search -->
      <div class="hidden shrink-0 items-center gap-2 lg:flex">
        <button
          v-if="showCreate"
          class="bg-primary shadow-primary/20 flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-(--text-inverse) shadow-sm transition-all hover:opacity-90 active:scale-95 xl:px-4"
          @click="$emit('create')"
        >
          <AppIcon name="plus" class="size-4" />
          {{ t('order.manage.create') }}
        </button>

        <button
          class="text-primary flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-card) transition-all hover:bg-(--bg-hover) active:scale-95"
          :title="t('dashboard.stats')"
          @click="$emit('show-stats')"
        >
          <AppIcon name="chart-bar" class="size-5" />
        </button>

        <button
          :disabled="exporting"
          class="flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-card) text-(--text-main) transition-all hover:bg-(--bg-hover) active:scale-95 disabled:opacity-50"
          :title="t('order.manage.export')"
          @click="$emit('export')"
        >
          <AppIcon v-if="exporting" name="spinner" class="size-4 animate-spin" />
          <AppIcon v-else name="arrow-down-tray" class="size-4" />
        </button>
      </div>
    </template>
  </AppFilterBar>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import SearchInput from '@/components/ui/SearchInput.vue';
import Select from '@/components/ui/Select.vue';
import AppFilterBar from '@/components/ui/AppFilterBar.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const {
  filters,
  salespersons = [],
  statuses = [],
  procurementStatuses = [],
  deliveryStatuses = [],
  exporting = false,
  showCreate = false,
} = defineProps({
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
  procurementStatuses: {
    type: Array,
    default: () => [],
  },
  deliveryStatuses: {
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
  ...salespersons.map(s => ({ label: s.name, value: s.id }))
]);

const statusOptions = computed(() => [
  { 
    label: isMobile.value ? t('order.manage.statusShort') : t('order.manage.allStatuses'), 
    value: '' 
  },
  ...statuses.map(s => ({ label: t(`order.statuses.${s}`), value: s }))
]);

const procurementStatusOptions = computed(() => [
  {
    label: isMobile.value ? t('order.manage.procurementStatusShort') : t('order.manage.allProcurementStatuses'),
    value: '',
  },
  ...procurementStatuses.map((s) => ({ label: t(`order.procurementStatuses.${s}`), value: s })),
]);

const deliveryStatusOptions = computed(() => [
  {
    label: isMobile.value ? t('order.manage.deliveryStatusShort') : t('order.manage.allDeliveryStatuses'),
    value: '',
  },
  ...deliveryStatuses.map((s) => ({ label: t(`order.deliveryStatuses.${s}`), value: s })),
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
