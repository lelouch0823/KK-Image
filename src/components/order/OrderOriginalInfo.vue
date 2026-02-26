<template>
  <div>
    <h4
      class="border-(--border-subtle) text-primary mb-3 border-b pb-2 text-sm font-medium"
    >
      {{ t('order.detail.originalInfo') }}
    </h4>
    <div
      class="bg-(--bg-muted) text-(--text-secondary) grid grid-cols-2 gap-3 rounded-lg p-4 text-sm"
    >
      <div>
        <span class="text-(--text-muted) block text-xs">{{ t('order.form.productName') }}</span>
        <span class="text-(--text-main) font-medium">{{ data.name || '-' }}</span>
      </div>
      <div>
        <span class="text-(--text-muted) block text-xs">{{ t('order.form.brand') }}</span>
        <span class="text-(--text-main)">{{ data.brand || '-' }}</span>
      </div>
      <div>
        <span class="text-(--text-muted) block text-xs">{{ t('order.form.series') }}</span>
        <span class="text-(--text-main)">{{ data.series || '-' }}</span>
      </div>
      <div>
        <span class="text-(--text-muted) block text-xs">{{ t('order.form.size') }}</span>
        <span class="text-(--text-main)">{{ data.size || '-' }}</span>
      </div>
      <div>
        <span class="text-(--text-muted) block text-xs">{{ t('order.form.color') }}</span>
        <span class="text-(--text-main)">{{ data.color || '-' }}</span>
      </div>
      <div>
        <span class="text-(--text-muted) block text-xs">{{ t('order.form.material') }}</span>
        <span class="text-(--text-main)">{{ data.material || '-' }}</span>
      </div>
      <!-- 期望到货时间 (全宽) -->
      <div class="col-span-2 flex items-start gap-2">
        <span class="text-(--text-muted) block w-24 shrink-0 pt-0.5 text-xs whitespace-nowrap">{{
          t('order.form.expectedArrival')
        }}</span>
        <span class="text-(--text-main)">{{ formatDateWithWeekday(data.deadline) }}</span>
      </div>
      <div class="col-span-2 flex items-start gap-2">
        <span class="text-(--text-muted) block w-24 shrink-0 pt-0.5 text-xs">{{
          t('order.form.remark')
        }}</span>
        <p class="text-(--text-main) whitespace-pre-wrap">{{ data.remark || '-' }}</p>
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
});

const { t } = useI18n();
</script>
