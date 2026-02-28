<template>
  <div>
    <h4
      class="text-primary mb-3 border-b border-(--border-subtle) pb-2 text-sm font-medium"
    >
      {{ t('order.detail.originalInfo') }}
    </h4>
    <div
      class="grid grid-cols-2 gap-3 rounded-lg bg-(--bg-muted) p-4 text-sm text-(--text-secondary)"
    >
      <div>
        <span class="block text-xs text-(--text-muted)">{{ t('order.form.productName') }}</span>
        <span class="font-medium text-(--text-main)">{{ data.name || '-' }}</span>
      </div>
      <div>
        <span class="block text-xs text-(--text-muted)">{{ t('order.form.brand') }}</span>
        <span class="text-(--text-main)">{{ data.brand || '-' }}</span>
      </div>
      <div>
        <span class="block text-xs text-(--text-muted)">{{ t('order.form.series') }}</span>
        <span class="text-(--text-main)">{{ data.series || '-' }}</span>
      </div>
      <div>
        <span class="block text-xs text-(--text-muted)">{{ t('order.form.size') }}</span>
        <span class="text-(--text-main)">{{ data.size || '-' }}</span>
      </div>
      <div>
        <span class="block text-xs text-(--text-muted)">{{ t('order.form.color') }}</span>
        <span class="text-(--text-main)">{{ data.color || '-' }}</span>
      </div>
      <div>
        <span class="block text-xs text-(--text-muted)">{{ t('order.form.material') }}</span>
        <span class="text-(--text-main)">{{ data.material || '-' }}</span>
      </div>
      <!-- 期望到货时间 (全宽) -->
      <div class="col-span-2 flex items-start gap-2">
        <span class="block w-24 shrink-0 pt-0.5 text-xs whitespace-nowrap text-(--text-muted)">{{
          t('order.form.expectedArrival')
        }}</span>
        <span class="text-(--text-main)">{{ formatDateWithWeekday(data.deadline) }}</span>
      </div>
      <div class="col-span-2 flex items-start gap-2">
        <span class="block w-24 shrink-0 pt-0.5 text-xs text-(--text-muted)">{{
          t('order.form.remark')
        }}</span>
        <p class="whitespace-pre-wrap text-(--text-main)">{{ data.remark || '-' }}</p>
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
