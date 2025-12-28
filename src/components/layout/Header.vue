<template>
  <header class="h-[var(--header-height)] bg-white border-b border-[var(--border-color)] flex items-center justify-between px-6 shrink-0">
    <h1 class="text-xl font-semibold text-primary">{{ viewTitle }}</h1>
    <div class="flex items-center gap-4">
      <!-- 搜索框 -->
      <div class="relative">
        <input type="text" :placeholder="t('header.searchPlaceholder')" v-model="searchQuery"
          class="w-64 h-9 pl-9 pr-4 text-sm border border-[var(--border-color)] rounded-lg bg-[var(--bg-page)] focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all" />
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
      <!-- 刷新按钮 -->
      <button :title="t('header.refresh')" class="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50">
        <svg class="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useView } from '@/composables/useView';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch'; // New composable

const { viewTitle } = useView();
const { t } = useI18n();
const { searchQuery } = useSearch();

// Local model for debouncing if needed, but for now direct binding
</script>
