<template>
  <AppFilterBar>
    <template #actions>
      <!-- Mobile: Icon buttons only -->
      <div class="flex shrink-0 items-center gap-1 lg:hidden">
        <AppButton
          v-if="showCreate"
          variant="primary"
          size="sm"
          class="!h-9 !w-9 !gap-0 !px-0 shadow-sm [&_span]:hidden"
          :title="t('order.manage.create')"
          @click="$emit('create')"
        >
          <template #icon-left>
            <AppIcon name="plus" class="size-5" />
          </template>
        </AppButton>

        <!-- Mobile Stats Button -->
        <AppButton
          variant="white"
          size="sm"
          class="text-primary !h-9 !w-9 !gap-0 !px-0 [&_span]:hidden"
          :title="t('dashboard.stats')"
          @click="$emit('show-stats')"
        >
          <template #icon-left>
            <AppIcon name="chart-bar" class="size-5" />
          </template>
        </AppButton>

        <AppButton
          variant="white"
          size="sm"
          :disabled="exporting"
          :loading="exporting"
          class="!h-9 !w-9 !gap-0 !px-0 text-(--text-main) [&_span]:hidden"
          :title="t('order.manage.export')"
          @click="$emit('export')"
        >
          <template #icon-left>
            <AppIcon name="document-arrow-down" class="size-4" />
          </template>
        </AppButton>
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
          :placeholder="
            isMobile
              ? t('order.manage.procurementStatusShort')
              : t('order.manage.allProcurementStatuses')
          "
          size="sm"
          @update:model-value="$emit('update:filters', { ...filters, procurementStatus: $event })"
        />
      </div>

      <div class="w-28 sm:w-40 lg:w-32 xl:w-40">
        <Select
          :model-value="filters.deliveryStatus"
          :options="deliveryStatusOptions"
          :placeholder="
            isMobile ? t('order.manage.deliveryStatusShort') : t('order.manage.allDeliveryStatuses')
          "
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
        <AppButton
          v-if="showCreate"
          variant="primary"
          size="sm"
          class="shadow-primary/20 whitespace-nowrap shadow-sm xl:px-4"
          @click="$emit('create')"
        >
          <template #icon-left>
            <AppIcon name="plus" class="size-4" />
          </template>
          {{ t('order.manage.create') }}
        </AppButton>

        <AppButton
          variant="white"
          size="sm"
          class="text-primary !h-9 !w-9 !gap-0 !px-0 [&_span]:hidden"
          :title="t('dashboard.stats')"
          @click="$emit('show-stats')"
        >
          <template #icon-left>
            <AppIcon name="chart-bar" class="size-5" />
          </template>
        </AppButton>

        <AppButton
          variant="white"
          size="sm"
          :disabled="exporting"
          :loading="exporting"
          class="!h-9 !w-9 !gap-0 !px-0 text-(--text-main) [&_span]:hidden"
          :title="t('order.manage.export')"
          @click="$emit('export')"
        >
          <template #icon-left>
            <AppIcon name="arrow-down-tray" class="size-4" />
          </template>
        </AppButton>
      </div>
    </template>
  </AppFilterBar>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useMobileDetect } from '@/composables/useMobileDetect';
import SearchInput from '@/components/ui/SearchInput.vue';
import Select from '@/components/ui/Select.vue';
import AppFilterBar from '@/components/ui/AppFilterBar.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import {
  formatOrderDeliveryStatusLabel,
  formatOrderProcurementStatusLabel,
  formatOrderStatusLabel,
} from '@/utils/display-labels';

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
const { isMobile } = useMobileDetect(640);

const salespersonOptions = computed(() => [
  {
    label: isMobile.value ? t('order.manage.salesShort') : t('order.manage.allSalespersons'),
    value: '',
  },
  ...salespersons.map((s) => ({ label: s.name, value: s.id })),
]);

const statusOptions = computed(() => [
  {
    label: isMobile.value ? t('order.manage.statusShort') : t('order.manage.allStatuses'),
    value: '',
  },
  ...statuses.map((s) => ({ label: formatOrderStatusLabel(t, s), value: s })),
]);

const procurementStatusOptions = computed(() => [
  {
    label: isMobile.value
      ? t('order.manage.procurementStatusShort')
      : t('order.manage.allProcurementStatuses'),
    value: '',
  },
  ...procurementStatuses.map((s) => ({ label: formatOrderProcurementStatusLabel(t, s), value: s })),
]);

const deliveryStatusOptions = computed(() => [
  {
    label: isMobile.value
      ? t('order.manage.deliveryStatusShort')
      : t('order.manage.allDeliveryStatuses'),
    value: '',
  },
  ...deliveryStatuses.map((s) => ({ label: formatOrderDeliveryStatusLabel(t, s), value: s })),
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
