<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- Status (Left) -->
    <div class="w-24 sm:w-28">
        <Select
            :model-value="status"
            :options="statusOptions"
            :placeholder="isMobile ? t('product.filters.status.short_label') : t('product.filters.status.all')"
            size="sm"
            @update:model-value="$emit('update:status', $event); $emit('refresh')"
        />
    </div>

    <!-- Search (Right, flex-1) -->
    <div class="min-w-0 flex-1">
        <SearchInput
            :model-value="search"
            :placeholder="t('product.filters.search_placeholder')"
            size="sm"
            @update:model-value="$emit('update:search', $event)"
            @search="$emit('refresh')"
        />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Select from '@/components/ui/Select.vue';
import SearchInput from '@/components/ui/SearchInput.vue';

const { t } = useI18n();
defineProps({
    search: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        default: ''
    }
});
defineEmits(['update:search', 'update:status', 'refresh']);

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
    { label: isMobile.value ? t('product.filters.status.short_label') : t('product.filters.status.all'), value: '' },
    { label: t('product.filters.status.active'), value: 'active' },
    { label: t('product.filters.status.archived'), value: 'archived' }
]);
</script>
