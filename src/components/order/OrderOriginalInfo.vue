<template>
  <div>
    <h4
      class="text-primary mb-3 border-b border-[var(--border-color)] pb-2 text-sm font-medium"
    >
      {{ t('order.detail.originalInfo') }}
    </h4>
    <div
      class="text-secondary grid grid-cols-2 gap-3 rounded-lg bg-[var(--bg-muted)] p-4 text-sm"
    >
      <div>
        <span class="text-muted block text-xs">{{ t('order.form.productName') }}</span>
        <span class="text-primary font-medium">{{ data.name || '-' }}</span>
      </div>
      <div>
        <span class="text-muted block text-xs">{{ t('order.form.brand') }}</span>
        <span class="text-primary">{{ data.brand || '-' }}</span>
      </div>
      <div>
        <span class="text-muted block text-xs">{{ t('order.form.series') }}</span>
        <span class="text-primary">{{ data.series || '-' }}</span>
      </div>
      <div>
        <span class="text-muted block text-xs">{{ t('order.form.size') }}</span>
        <span class="text-primary">{{ data.size || '-' }}</span>
      </div>
      <div>
        <span class="text-muted block text-xs">{{ t('order.form.color') }}</span>
        <span class="text-primary">{{ data.color || '-' }}</span>
      </div>
      <div>
        <span class="text-muted block text-xs">{{ t('order.form.material') }}</span>
        <span class="text-primary">{{ data.material || '-' }}</span>
      </div>
      <!-- 期望到货时间 (全宽) -->
      <div class="col-span-2 flex items-start gap-2">
        <span class="text-muted block w-24 shrink-0 pt-0.5 text-xs whitespace-nowrap">{{
          t('order.form.expectedArrival')
        }}</span>
        <span class="text-primary">{{ formatDateWithWeekday(data.deadline) }}</span>
      </div>
      <div class="col-span-2 flex items-start gap-2">
        <span class="text-muted block w-24 shrink-0 pt-0.5 text-xs">{{
          t('order.form.remark')
        }}</span>
        <p class="text-primary whitespace-pre-wrap">{{ data.remark || '-' }}</p>
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
