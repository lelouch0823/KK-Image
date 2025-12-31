<template>
  <Modal v-model="visible" :title="t('order.dashboard.statusDistribution')" size="md">
    <div class="p-6">
      <div v-if="hasData" class="h-64 relative">
        <Pie :data="chartData" :options="chartOptions" />
      </div>
      <div v-else class="text-center text-gray-500 py-10">
        {{ t('common.noData') }}
      </div>
      
      <div class="mt-6 flex flex-wrap gap-4 justify-center">
        <div v-for="(value, key) in distribution" :key="key" class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: getColor(key) }"></span>
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
import Modal from '@/components/ui/Modal.vue';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  distribution: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const visible = useVModel(props, 'modelValue', emit);

const hasData = computed(() => {
  return props.distribution && Object.keys(props.distribution).length > 0;
});

const getColor = (status) => {
  const colors = {
    pending: '#f97316', // orange-500
    confirmed: '#22c55e', // green-500
    production: '#8b5cf6', // violet-500
    shipping: '#3b82f6', // blue-500
    arrived: '#0ea5e9', // sky-500
    delivered: '#64748b', // slate-500
    rejected: '#ef4444', // red-500
    void: '#9ca3af' // gray-400
  };
  return colors[status] || '#cbd5e1';
};

const chartData = computed(() => {
  const labels = Object.keys(props.distribution).map(k => t(`order.statuses.${k}`));
  const data = Object.values(props.distribution);
  const backgroundColor = Object.keys(props.distribution).map(k => getColor(k));

  return {
    labels,
    datasets: [
      {
        backgroundColor,
        data
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      display: false 
    }
  }
};
</script>
