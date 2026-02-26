<template>
  <div class="border-(--border-color) bg-(--bg-card) rounded-xl border p-4">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-sm font-medium text-primary">{{ t('order.detail.currentInfo') }}</h3>
      <!-- 修正标记 -->
      <span
        v-if="hasCorrection"
        class="bg-warning-bg text-warning hover:bg-warning hover:text-(--text-inverse) cursor-pointer rounded-full px-2 py-0.5 text-xs transition-colors"
        @click="$emit('viewCorrection')"
      >
        {{ t('order.portal.viewCorrection') }}
      </span>
    </div>

    <div class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      <div class="flex min-w-0 flex-col sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 text-sm sm:mb-0 sm:w-20">{{ t('order.form.productName') }}</span>
        <div class="flex min-w-0 flex-1 items-center gap-2">
            <span class="text-(--text-main) truncate text-sm" :title="data.name">{{ data.name || '-' }}</span>
        </div>
      </div>
      <div class="flex min-w-0 flex-col sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 text-sm sm:mb-0 sm:w-20">{{ t('order.form.quantity') }}</span>
        <span class="text-(--text-main) min-w-0 flex-1 truncate text-sm font-medium" :title="quantity">{{ quantity }}</span>
      </div>
      <div class="flex min-w-0 flex-col sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 text-sm sm:mb-0 sm:w-20">{{ t('order.form.brand') }}</span>
        <span class="text-(--text-main) min-w-0 flex-1 truncate text-sm" :title="data.brand">{{ data.brand || '-' }}</span>
      </div>
      <div class="flex min-w-0 flex-col sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 text-sm sm:mb-0 sm:w-20">{{ t('order.form.series') }}</span>
        <span class="text-(--text-main) min-w-0 flex-1 truncate text-sm" :title="data.series">{{ data.series || '-' }}</span>
      </div>
      <div class="flex min-w-0 flex-col sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 text-sm sm:mb-0 sm:w-20">{{ t('order.form.sku') }}</span>
        <span class="text-(--text-main) min-w-0 flex-1 truncate text-sm" :title="data.sku">{{ data.sku || '-' }}</span>
      </div>
      <div class="flex min-w-0 flex-col sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 text-sm sm:mb-0 sm:w-20">{{ t('order.form.size') }}</span>
        <span class="text-(--text-main) min-w-0 flex-1 truncate text-sm" :title="data.size">{{ data.size || '-' }}</span>
      </div>
      <div class="flex min-w-0 flex-col sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 text-sm sm:mb-0 sm:w-20">{{ t('order.form.color') }}</span>
        <span class="text-(--text-main) min-w-0 flex-1 truncate text-sm" :title="data.color">{{ data.color || '-' }}</span>
      </div>
      <div class="flex min-w-0 flex-col sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 text-sm sm:mb-0 sm:w-20">{{ t('order.form.material') }}</span>
        <span class="text-(--text-main) min-w-0 flex-1 truncate text-sm" :title="data.material">{{ data.material || '-' }}</span>
      </div>
      <!-- 期望到货时间 (全宽) -->
      <div class="col-span-1 flex min-w-0 flex-col sm:col-span-2 sm:flex-row">
        <span class="text-(--text-secondary) mb-1 shrink-0 whitespace-nowrap text-sm sm:mb-0 sm:w-28">{{
          t('order.form.expectedArrival')
        }}</span>
        <span class="text-(--text-main) min-w-0 flex-1 truncate text-sm" :title="formatDeadline(data.deadline)">{{ formatDeadline(data.deadline) }}</span>
      </div>
      <!-- 备注 (全宽) -->
      <div class="col-span-1 flex min-w-0 flex-col sm:col-span-2 sm:flex-row">
        <span class="text-(--text-secondary) mb-2 shrink-0 text-sm sm:mb-0 sm:w-28">{{ t('order.form.remark') }}</span>
        <p
          class="border-(--border-color) bg-(--bg-muted) text-(--text-main) w-full rounded-lg border p-2 text-sm whitespace-pre-wrap break-words"
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
