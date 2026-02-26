<template>
  <div class="border-(--border-color) bg-(--bg-card) rounded-xl border p-4 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <p class="text-(--text-secondary) mb-1 truncate font-mono text-xs">{{ orderNo }}</p>
        <h2
          class="text-primary truncate text-lg font-bold"
          :title="productName || t('order.form.productName')"
        >
          {{ productName || t('order.form.productName') }}
        </h2>
      </div>
      <StatusBadge class="shrink-0" :variant="getStatusVariant(status)" size="md" dot>
        {{ t(`order.statuses.${status}`) }}
      </StatusBadge>
    </div>

    <!-- 状态流程条 -->
    <div class="relative mt-6">
      <div class="bg-(--border-color) absolute top-3 right-0 left-0 h-0.5"></div>
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
                ? 'bg-primary border-primary text-(--text-inverse)'
                : 'text-(--text-secondary) border-(--border-hover) bg-(--bg-card)'
            "
          >
            <AppIcon v-if="index < currentStepIndex" name="check" class="size-3 stroke-3" />
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span
            class="mt-1.5 text-center text-[10px] whitespace-nowrap"
            :class="
              index <= currentStepIndex ? 'text-primary font-medium' : 'text-(--text-secondary)'
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
import AppIcon from '@/components/ui/AppIcon.vue';

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
  quantity: {
    type: Number,
    default: 1,
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
