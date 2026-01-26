<template>
  <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-sm font-medium text-[var(--color-primary)]">{{ t('order.detail.currentInfo') }}</h3>
      <!-- 修正标记 -->
      <span
        v-if="hasCorrection"
        class="cursor-pointer rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs text-[var(--color-warning-text)] transition-colors hover:bg-[var(--color-warning-text)] hover:text-[var(--text-inverse)]"
        @click="$emit('viewCorrection')"
      >
        {{ t('order.portal.viewCorrection') }}
      </span>
    </div>

    <div class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      <div class="flex flex-col sm:flex-row">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.productName') }}</span>
        <div class="flex items-center gap-2 overflow-hidden">
            <span class="truncate text-sm text-[var(--text-main)]">{{ data.name || '-' }}</span>
            <span class="flex-shrink-0 rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">x {{ quantity }}</span>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.brand') }}</span>
        <span class="truncate text-sm text-[var(--text-main)]">{{ data.brand || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.series') }}</span>
        <span class="truncate text-sm text-[var(--text-main)]">{{ data.series || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.sku') }}</span>
        <span class="truncate text-sm text-[var(--text-main)]">{{ data.sku || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.size') }}</span>
        <span class="truncate text-sm text-[var(--text-main)]">{{ data.size || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.color') }}</span>
        <span class="truncate text-sm text-[var(--text-main)]">{{ data.color || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.material') }}</span>
        <span class="truncate text-sm text-[var(--text-main)]">{{ data.material || '-' }}</span>
      </div>
      <!-- 期望到货时间 (全宽) -->
      <div class="col-span-1 flex flex-col sm:col-span-2 sm:flex-row">
        <span class="mb-1 flex-shrink-0 whitespace-nowrap text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-28">{{
          t('order.form.expectedArrival')
        }}</span>
        <span class="text-sm text-[var(--text-main)]">{{ formatDeadline(data.deadline) }}</span>
      </div>
      <!-- 备注 (全宽) -->
      <div class="col-span-1 flex flex-col sm:col-span-2 sm:flex-row">
        <span class="mb-2 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-28">{{ t('order.form.remark') }}</span>
        <p
          class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] p-2 text-sm whitespace-pre-wrap text-[var(--text-main)]"
        >
          {{ data.remark || '-' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { formatDateWithWeekday } from '@/utils/formatters';

defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  hasCorrection: {
    type: Boolean,
    default: false,
  },
  quantity: {
    type: Number,
    default: 1,
  },
});

defineEmits(['viewCorrection']);

const { t } = useI18n();

const formatDeadline = (date) => formatDateWithWeekday(date);
</script>
