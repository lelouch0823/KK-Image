<template>
  <div
    v-if="isLoading"
    class="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-2xl border border-(--border-color) bg-(--bg-card) p-6 text-center"
    data-testid="async-loading"
  >
    <AppIcon name="spinner" class="text-primary size-8 animate-spin" />
    <p class="text-sm text-(--text-secondary)">{{ loadingText }}</p>
  </div>

  <div
    v-else-if="isError"
    class="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-2xl border border-(--color-danger-text)/20 bg-(--color-danger-bg)/40 p-6 text-center"
    data-testid="async-error"
  >
    <p class="text-base font-semibold text-(--text-main)">{{ titleText }}</p>
    <p class="max-w-md text-sm text-(--text-secondary)">{{ errorText }}</p>
    <div class="flex items-center gap-2">
      <AppButton
        data-testid="retry-action"
        :text="retryText"
        @click="$emit('retry')"
      />
      <slot name="actions"></slot>
    </div>
  </div>

  <div
    v-else-if="isEmpty"
    class="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-(--border-color) bg-(--bg-card) p-6 text-center"
    data-testid="async-empty"
  >
    <p class="text-base font-semibold text-(--text-main)">{{ titleText }}</p>
    <p class="text-sm text-(--text-secondary)">{{ descriptionText }}</p>
    <slot name="actions"></slot>
  </div>

  <slot v-else></slot>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  state: { type: String, default: 'ready' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  error: { type: String, default: '' },
  retryLabel: { type: String, default: '' },
});

defineEmits(['retry']);

const { t } = useI18n();

const isLoading = computed(() => props.state === 'loading' || props.state === 'recovering');
const isError = computed(() => props.state === 'error');
const isEmpty = computed(() => props.state === 'empty');

const loadingText = computed(() => t('common.loading'));
const retryText = computed(() => props.retryLabel || t('common.retry'));
const titleText = computed(() => props.title || t('common.loadFailed'));
const descriptionText = computed(() => props.description || t('common.noData'));
const errorText = computed(() => props.error || props.description || t('common.networkError'));
</script>
