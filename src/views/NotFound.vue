<template>
  <div class="flex min-h-[70vh] w-full items-center justify-center bg-(--bg-page) px-4">
    <EmptyState
      icon="search"
      :title="t('common.pageNotFound')"
      :description="t('common.pageNotFoundDesc')"
    >
      <template #action>
        <router-link to="/">
          <AppButton variant="primary" :text="t('common.backHome')">
            <template #icon-left>
              <AppIcon name="home" class="size-4" />
            </template>
          </AppButton>
        </router-link>
      </template>
    </EmptyState>
  </div>
</template>

<script setup>
import EmptyState from '@/components/ui/EmptyState.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
</script>
