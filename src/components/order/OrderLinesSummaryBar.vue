<template>
  <AppCard
    padding="p-4"
    indicator="primary"
    class="border-(--border-color)"
    data-testid="order-lines-summary"
  >
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="space-y-1">
        <p class="text-sm font-semibold text-(--text-main)">
          {{ t('order.form.multilineSummaryTitle', '多行建单摘要') }}
        </p>
        <p class="text-xs text-(--text-secondary)">
          {{
            summary.pendingLineCount > 0
              ? t('order.form.multilineSummaryPending', `还有 ${summary.pendingLineCount} 行待完善`)
              : t('order.form.multilineSummaryReady', '当前所有明细均可提交')
          }}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="rounded-xl border border-(--border-color) bg-(--bg-muted)/40 px-3 py-2">
          <div class="text-xs uppercase tracking-[0.16em] text-(--text-secondary)">
            {{ t('order.form.summaryLines', '明细行数') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-(--text-main)">
            {{ summary.lineCount }}
          </div>
        </div>
        <div
          class="rounded-xl border border-(--border-color) bg-(--bg-muted)/40 px-3 py-2"
          data-testid="summary-total-quantity"
        >
          <div class="text-xs uppercase tracking-[0.16em] text-(--text-secondary)">
            {{ t('order.form.summaryQuantity', '总件数') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-(--text-main)">
            {{ summary.totalQuantity }}
          </div>
        </div>
        <div class="rounded-xl border border-(--border-color) bg-(--bg-muted)/40 px-3 py-2">
          <div class="text-xs uppercase tracking-[0.16em] text-(--text-secondary)">
            {{ t('order.form.summaryImages', '图片数量') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-(--text-main)">
            {{ summary.imageCount }}
          </div>
        </div>
        <div
          class="rounded-xl border px-3 py-2"
          :class="
            summary.pendingLineCount > 0
              ? 'border-(--color-warning-text)/20 bg-(--color-warning-bg)/40'
              : 'border-(--color-success-text)/20 bg-(--color-success-bg)/30'
          "
          data-testid="summary-pending-lines"
        >
          <div class="text-xs uppercase tracking-[0.16em] text-(--text-secondary)">
            {{ t('order.form.summaryPending', '待完善') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-(--text-main)">
            {{ summary.pendingLineCount }}
          </div>
        </div>
      </div>
    </div>
  </AppCard>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppCard from '@/components/ui/AppCard.vue';

defineProps({
  summary: {
    type: Object,
    required: true,
  },
});

const { t } = useI18n();
</script>
