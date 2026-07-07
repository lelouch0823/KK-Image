<template>
  <section
    data-testid="purchase-order-detail-progress"
    class="rounded-[1.5rem] border border-(--border-color)/65 bg-(--bg-card) p-5 shadow-none"
  >
    <div class="space-y-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
            Fulfillment
          </p>
          <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
            {{ t('purchaseOrder.detail.title', '采购单详情') }}
          </h3>
        </div>
        <div class="flex flex-col items-end gap-1.5">
          <span
            class="rounded-full bg-(--bg-muted) px-2.5 py-1 text-xs font-medium text-(--text-secondary)"
          >
            {{ formatPurchaseOrderStatusLabel(detail.status, statusConfig) }}
          </span>
          <template
            v-if="
              detail.display_status ||
              detail.ordered_qty ||
              detail.received_qty ||
              detail.cancelled_qty
            "
          >
            <StatusBadge
              data-testid="purchase-order-detail-progress-badge"
              :variant="helpers.getProgressStatusVariant(detail.display_status)"
              class="text-xs"
            >
              {{ helpers.getProgressStatusLabel(detail.display_status) }}
            </StatusBadge>
            <span
              data-testid="purchase-order-detail-progress-summary"
              class="text-right text-xs text-(--text-secondary)"
            >
              {{ helpers.buildReceiptProgressSummary(detail) }}
            </span>
          </template>
        </div>
      </div>

      <div class="relative flex items-center justify-between">
        <div
          class="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 bg-(--border-color)"
        ></div>
        <div
          class="bg-primary absolute top-1/2 left-0 h-0.5 -translate-y-1/2 transition-all duration-500"
          :style="{ width: helpers.getStepperProgress(stepsList, detail.status) }"
        ></div>

        <div
          v-for="step in stepsList"
          :key="step.value"
          class="relative z-10 flex flex-col items-center gap-2"
        >
          <div
            class="flex size-7 items-center justify-center rounded-full border-2 transition-colors duration-300"
            :class="helpers.getStepIconClasses(stepsList, detail.status, step.value)"
          >
            <AppIcon
              v-if="helpers.isStepCompleted(stepsList, detail.status, step.value)"
              name="check"
              class="size-3.5 text-(--text-inverse)"
              stroke-width="3"
            />
            <div
              v-else-if="detail.status === step.value"
              class="bg-primary size-2 rounded-full"
            ></div>
          </div>
          <span
            class="text-center text-xs font-medium"
            :class="
              detail.status === step.value
                ? 'text-(--text-main)'
                : helpers.isStepCompleted(stepsList, detail.status, step.value)
                  ? 'text-(--text-main)'
                  : 'text-(--text-muted)'
            "
          >
            {{ step.label }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { formatPurchaseOrderStatusLabel } from '@/utils/display-labels';

const props = defineProps({
  detail: {
    type: Object,
    required: true,
  },
  stepsList: {
    type: Array,
    default: () => [],
  },
  statusConfig: {
    type: Object,
    default: () => ({}),
  },
  t: {
    type: Function,
    required: true,
  },
  helpers: {
    type: Object,
    required: true,
  },
});

</script>
