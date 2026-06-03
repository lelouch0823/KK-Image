<template>
  <div class="border-success/20 bg-(--color-success-bg) rounded-2xl border p-4 shadow-card">
    <div class="flex items-start gap-3">
      <div class="text-success flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--bg-card) shadow-sm">
        <AppIcon name="check-badge" class="size-5" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-sm font-semibold text-(--text-main)">{{ t('common.ai.actionResult.created') }}</p>
          <span class="rounded-full bg-(--bg-card) px-2.5 py-1 text-xs font-medium text-(--text-secondary)">
            {{ moduleLabel }}
          </span>
        </div>
        <p class="mt-2 text-sm leading-6 text-(--text-secondary)">{{ successText }}</p>
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl bg-(--bg-card) p-3 shadow-sm">
        <p class="text-xs tracking-[0.08em] text-(--text-secondary) uppercase">{{ t('common.ai.actionResult.result') }}</p>
        <p class="mt-1 text-sm font-medium text-(--text-main)">{{ entityLabel }}</p>
      </div>

      <div
        data-testid="result-destination"
        class="border-primary/20 bg-primary/6 rounded-xl border p-3 shadow-sm"
      >
        <p class="text-xs tracking-[0.08em] text-(--text-secondary) uppercase">{{ t('common.ai.actionResult.goTo') }}</p>
        <p class="mt-1 text-sm font-medium text-(--text-main)">{{ moduleLabel }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();

const props = defineProps({
  action: {
    type: Object,
    default: () => ({}),
  },
});

const MODULE_LABELS = computed(() => ({
  orders: t('common.ai.actionResult.modules.orders'),
  purchaseOrders: t('common.ai.actionResult.modules.purchaseOrders'),
  products: t('common.ai.actionResult.modules.products'),
  customers: t('common.ai.actionResult.modules.customers'),
  salespersons: t('common.ai.actionResult.modules.salespersons'),
}));

const successText = computed(() => props.action?.successMessage || t('common.ai.actionResult.defaultSuccess'));
const entityLabel = computed(() => props.action?.createdEntityLabel || props.action?.createdEntityId || t('common.ai.actionResult.defaultEntity'));
const moduleLabel = computed(() => MODULE_LABELS.value[props.action?.targetModule] || t('common.ai.actionResult.defaultModule'));
</script>
