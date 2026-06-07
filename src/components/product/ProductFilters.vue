<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="w-24 sm:w-28 lg:w-24 xl:w-28">
      <Select
        :model-value="status"
        :options="statusOptions"
        :placeholder="
          isMobile ? t('product.filters.status.short_label') : t('product.filters.status.all')
        "
        size="sm"
        @update:model-value="
          $emit('update:status', $event);
          $emit('refresh');
        "
      />
    </div>

    <div class="w-24 sm:w-32 lg:w-28 xl:w-36">
      <Select
        :model-value="brand"
        :options="brandSelectOptions"
        :placeholder="t('order.form.brand', '品牌')"
        size="sm"
        @update:model-value="
          $emit('update:brand', $event);
          $emit('refresh');
        "
      />
    </div>

    <div class="w-24 sm:w-32 lg:w-28 xl:w-36">
      <Select
        :model-value="category"
        :options="categorySelectOptions"
        :placeholder="t('product.form.category')"
        size="sm"
        @update:model-value="
          $emit('update:category', $event);
          $emit('refresh');
        "
      />
    </div>

    <div class="w-24 sm:w-32 lg:w-28 xl:w-32">
      <Select
        :model-value="hasStock"
        :options="stockOptions"
        :placeholder="t('product.filters.stock', '库存')"
        size="sm"
        @update:model-value="
          $emit('update:hasStock', $event);
          $emit('refresh');
        "
      />
    </div>

    <div class="min-w-0 basis-full lg:min-w-[12rem] lg:flex-1">
      <SearchInput
        :model-value="search"
        :placeholder="t('product.filters.search_placeholder')"
        size="sm"
        @update:model-value="$emit('update:search', $event)"
        @search="$emit('refresh')"
      />
    </div>

    <div class="hidden shrink-0 items-center gap-2 lg:flex">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Select from '@/components/ui/Select.vue';
import SearchInput from '@/components/ui/SearchInput.vue';

const { t } = useI18n();
const props = defineProps({
  search: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: '',
  },
  brand: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: '',
  },
  hasStock: {
    type: String,
    default: '',
  },
  brandOptions: {
    type: Array,
    default: () => [],
  },
  categoryOptions: {
    type: Array,
    default: () => [],
  },
});
defineEmits([
  'update:search',
  'update:status',
  'update:brand',
  'update:category',
  'update:hasStock',
  'refresh',
]);

// 移动端检测
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

const statusOptions = computed(() => [
  {
    label: isMobile.value
      ? t('product.filters.status.short_label')
      : t('product.filters.status.all'),
    value: '',
  },
  { label: t('product.filters.status.draft'), value: 'draft' },
  { label: t('product.filters.status.active'), value: 'active' },
  { label: t('product.filters.status.archived'), value: 'archived' },
]);

const brandSelectOptions = computed(() => [
  { label: t('order.form.brand', '品牌'), value: '' },
  ...props.brandOptions.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option
  ),
]);

const categorySelectOptions = computed(() => [
  { label: t('product.form.category'), value: '' },
  ...props.categoryOptions.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option
  ),
]);

const stockOptions = computed(() => [
  { label: t('product.filters.stock', '库存'), value: '' },
  { label: t('product.filters.inStock', '有库存'), value: 'in_stock' },
  { label: t('product.filters.outOfStock', '无库存'), value: 'out_of_stock' },
]);
</script>
