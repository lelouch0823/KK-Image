<template>
  <div class="flex h-screen w-full items-center justify-center bg-(--bg-page)">
    <EmptyState
      icon="search"
      :title="t('common.pageNotFound')"
      :description="t('common.pageNotFoundDesc')"
    >
      <template #action>
        <router-link
          to="/"
          class="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-(--text-inverse) transition-all hover:bg-(--color-primary-hover) active:scale-95"
        >
          {{ t('common.backHome') }}
        </router-link>
      </template>
    </EmptyState>
  </div>
</template>

<script setup>
import EmptyState from '@/components/ui/EmptyState.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
</script>
