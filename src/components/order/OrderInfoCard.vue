<template>
  <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-primary text-sm font-medium">{{ t('order.detail.currentInfo') }}</h3>
      <!-- 修正标记 -->
      <span
        v-if="hasCorrection"
        class="cursor-pointer rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs text-[var(--color-warning-text)] transition-colors hover:bg-[var(--color-warning)] hover:text-white"
        @click="$emit('viewCorrection')"
      >
        {{ t('order.portal.viewCorrection') }}
      </span>
    </div>

    <div class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      <div class="flex">
        <span class="text-secondary w-20 flex-shrink-0 text-sm">{{ t('order.form.productName') }}</span>
        <span class="text-primary truncate text-sm">{{ data.name || '-' }}</span>
      </div>
      <div class="flex">
        <span class="text-secondary w-20 flex-shrink-0 text-sm">{{ t('order.form.brand') }}</span>
        <span class="text-primary truncate text-sm">{{ data.brand || '-' }}</span>
      </div>
      <div class="flex">
        <span class="text-secondary w-20 flex-shrink-0 text-sm">{{ t('order.form.series') }}</span>
        <span class="text-primary truncate text-sm">{{ data.series || '-' }}</span>
      </div>
      <div class="flex">
        <span class="text-secondary w-20 flex-shrink-0 text-sm">{{ t('order.form.sku') }}</span>
        <span class="text-primary truncate text-sm">{{ data.sku || '-' }}</span>
      </div>
      <div class="flex">
        <span class="text-secondary w-20 flex-shrink-0 text-sm">{{ t('order.form.size') }}</span>
        <span class="text-primary truncate text-sm">{{ data.size || '-' }}</span>
      </div>
      <div class="flex">
        <span class="text-secondary w-20 flex-shrink-0 text-sm">{{ t('order.form.color') }}</span>
        <span class="text-primary truncate text-sm">{{ data.color || '-' }}</span>
      </div>
      <div class="flex">
        <span class="text-secondary w-20 flex-shrink-0 text-sm">{{ t('order.form.material') }}</span>
        <span class="text-primary truncate text-sm">{{ data.material || '-' }}</span>
      </div>
      <!-- 期望到货时间 (全宽) -->
      <div class="col-span-1 flex sm:col-span-2">
        <span class="text-secondary w-28 flex-shrink-0 text-sm whitespace-nowrap">{{
          t('order.form.expectedArrival')
        }}</span>
        <span class="text-primary text-sm">{{ formatDeadline(data.deadline) }}</span>
      </div>
      <!-- 备注 (全宽) -->
      <div class="col-span-1 flex sm:col-span-2">
        <span class="text-secondary w-28 flex-shrink-0 text-sm">{{ t('order.form.remark') }}</span>
        <p
          class="text-primary w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] p-2 text-sm whitespace-pre-wrap"
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
});

defineEmits(['viewCorrection']);

const { t } = useI18n();

const formatDeadline = (date) => formatDateWithWeekday(date);
</script>
