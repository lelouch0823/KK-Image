<template>
  <div class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-100/50 p-1 sm:flex-row dark:border-slate-700/50 dark:bg-slate-800/50">
    <!-- Search -->
    <div class="relative flex-1">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg class="size-5  text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>
        <input
            :value="search"
            type="text"
            class="block w-full rounded-lg border-none bg-transparent py-2 pr-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500"
            :placeholder="t('product.filters.search_placeholder')"
            @input="$emit('update:search', $event.target.value)"
            @keydown.enter="$emit('refresh')"
        />
    </div>

    <!-- Status -->
    <select
        :value="status"
        class="block w-full border-l border-slate-300 bg-transparent py-2 pr-10 pl-3 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:w-40 dark:border-slate-700 dark:text-slate-300"
        @change="$emit('update:status', $event.target.value); $emit('refresh')"
    >
        <option value="">{{ t('product.filters.status.all') }}</option>
        <option value="active">{{ t('product.filters.status.active') }}</option>
        <option value="draft">{{ t('product.filters.status.draft') }}</option>
        <option value="archived">{{ t('product.filters.status.archived') }}</option>
    </select>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
defineProps({
    search: String,
    status: String
});
defineEmits(['update:search', 'update:status', 'refresh']);
</script>
