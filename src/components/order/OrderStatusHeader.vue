<template>
  <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm">
    <div class="flex items-start justify-between">
      <div>
        <p class="font-mono text-secondary mb-1 text-xs">{{ orderNo }}</p>
        <h2 class="text-primary text-lg font-bold">
          {{ productName || t('order.form.productName') }}
        </h2>
      </div>
      <StatusBadge :variant="getStatusVariant(status)" size="md" dot>
        {{ t(`order.statuses.${status}`) }}
      </StatusBadge>
    </div>

    <!-- 状态流程条 -->
    <div class="relative mt-6">
      <div class="absolute top-3 right-0 left-0 h-0.5 bg-[var(--border-color)]"></div>
      <div
        class="bg-primary absolute top-3 left-0 h-0.5 transition-all duration-300"
        :style="{ width: progressWidth }"
      ></div>
      <div class="relative flex justify-between">
        <div
          v-for="(step, index) in statusSteps"
          :key="step"
          class="flex flex-col items-center"
        >
          <div
            class="flex size-6 items-center justify-center rounded-full border-2 text-xs font-medium transition-all"
            :class="
              index <= currentStepIndex
                ? 'bg-primary border-primary text-white'
                : 'text-secondary border-[var(--border-hover)] bg-[var(--bg-card)]'
            "
          >
            <svg
              v-if="index < currentStepIndex"
              class="size-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span
            class="mt-1.5 text-center text-[10px] whitespace-nowrap"
            :class="
              index <= currentStepIndex ? 'text-primary font-medium' : 'text-secondary'
            "
          >
            {{ t(`order.statuses.${step}`) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { STATUS_OPTIONS, getStatusVariant } from '@/utils/status';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  orderNo: {
    type: String,
    required: true,
  },
  productName: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();

// 状态流程 (排除 rejected)
const statusSteps = STATUS_OPTIONS.filter((s) => s !== 'rejected');

const currentStepIndex = computed(() => {
  const idx = statusSteps.indexOf(props.status);
  return idx >= 0 ? idx : 0;
});

const progressWidth = computed(() => {
  const total = statusSteps.length - 1;
  return `${(currentStepIndex.value / total) * 100}%`;
});
</script>
