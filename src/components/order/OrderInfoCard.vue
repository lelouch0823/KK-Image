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
      <div class="flex flex-col sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.productName') }}</span>
        <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="truncate text-sm text-[var(--text-main)]" :title="data.name">{{ data.name || '-' }}</span>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.quantity') }}</span>
        <span class="truncate text-sm font-medium text-[var(--text-main)] min-w-0 flex-1" :title="quantity">{{ quantity }}</span>
      </div>
      <div class="flex flex-col sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.brand') }}</span>
        <span class="truncate text-sm text-[var(--text-main)] min-w-0 flex-1" :title="data.brand">{{ data.brand || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.series') }}</span>
        <span class="truncate text-sm text-[var(--text-main)] min-w-0 flex-1" :title="data.series">{{ data.series || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.sku') }}</span>
        <span class="truncate text-sm text-[var(--text-main)] min-w-0 flex-1" :title="data.sku">{{ data.sku || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.size') }}</span>
        <span class="truncate text-sm text-[var(--text-main)] min-w-0 flex-1" :title="data.size">{{ data.size || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.color') }}</span>
        <span class="truncate text-sm text-[var(--text-main)] min-w-0 flex-1" :title="data.color">{{ data.color || '-' }}</span>
      </div>
      <div class="flex flex-col sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-20">{{ t('order.form.material') }}</span>
        <span class="truncate text-sm text-[var(--text-main)] min-w-0 flex-1" :title="data.material">{{ data.material || '-' }}</span>
      </div>
      <!-- 期望到货时间 (全宽) -->
      <div class="col-span-1 flex flex-col sm:col-span-2 sm:flex-row min-w-0">
        <span class="mb-1 flex-shrink-0 text-sm whitespace-nowrap text-[var(--text-secondary)] sm:mb-0 sm:w-28">{{
          t('order.form.expectedArrival')
        }}</span>
        <span class="text-sm text-[var(--text-main)] min-w-0 flex-1 truncate" :title="formatDeadline(data.deadline)">{{ formatDeadline(data.deadline) }}</span>
      </div>
      <!-- 备注 (全宽) -->
      <div class="col-span-1 flex flex-col sm:col-span-2 sm:flex-row min-w-0">
        <span class="mb-2 flex-shrink-0 text-sm text-[var(--text-secondary)] sm:mb-0 sm:w-28">{{ t('order.form.remark') }}</span>
        <p
          class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] p-2 text-sm whitespace-pre-wrap break-words text-[var(--text-main)]"
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
