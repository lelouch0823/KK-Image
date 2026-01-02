<template>
  <Modal v-model="visible" :title="t('order.dashboard.statusDistribution')" size="md">
    <div class="p-6">
      <div v-if="hasData" class="relative h-64">
        <Pie :data="chartData" :options="chartOptions" />
      </div>
      <div v-else class="py-10 text-center text-gray-500">
        {{ t('common.noData') }}
      </div>

      <div class="mt-6 flex flex-wrap justify-center gap-4">
        <div v-for="(value, key) in distribution" :key="key" class="flex items-center gap-2">
          <span
            class="size-3 rounded-full"
            :style="{ backgroundColor: getStatusHexColor(key) }"
          ></span>
          <span class="text-sm text-gray-600">{{ t(`order.statuses.${key}`) }}: {{ value }}</span>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import { useVModel } from '@vueuse/core';
import { Pie } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useI18n } from '@/composables/useI18n';
import { getStatusHexColor } from '@/utils/status';
import Modal from '@/components/ui/Modal.vue';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  distribution: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const visible = useVModel(props, 'modelValue', emit);

const hasData = computed(() => {
  return props.distribution && Object.keys(props.distribution).length > 0;
});

const chartData = computed(() => {
  const labels = Object.keys(props.distribution).map((k) => t(`order.statuses.${k}`));
  const data = Object.values(props.distribution);
  const backgroundColor = Object.keys(props.distribution).map((k) => getStatusHexColor(k));

  return {
    labels,
    datasets: [
      {
        backgroundColor,
        data,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      display: false,
    },
  },
};
</script>
