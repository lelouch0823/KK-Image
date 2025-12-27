<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-12 text-secondary">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
      <p>正在加载数据...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-100 text-red-500 p-4 rounded-lg text-center">
       {{ error }}
    </div>

    <template v-else>
      <!-- Key Metrics -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div class="text-sm text-blue-600 font-medium mb-1">总访问量</div>
          <div class="text-2xl font-bold text-blue-900">{{ stats.total?.view_count || 0 }}</div>
        </div>
        <div class="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <div class="text-sm text-purple-600 font-medium mb-1">总下载量</div>
          <div class="text-2xl font-bold text-purple-900">{{ stats.total?.download_count || 0 }}</div>
        </div>
      </div>

      <!-- Chart -->
      <div class="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <h3 class="text-sm font-medium text-gray-900 mb-4">访客趋势 (近30天)</h3>
        <div class="h-64">
           <Line v-if="chartData" :data="chartData" :options="chartOptions" />
           <div v-else class="h-full flex items-center justify-center text-secondary text-sm">暂无数据</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const props = defineProps({
  spaceId: { type: String, required: true }
});

const loading = ref(true);
const error = ref('');
const stats = ref({});

const chartData = computed(() => {
    if (!stats.value.trend) return null;
    
    return {
        labels: stats.value.trend.map(d => d.date.slice(5)), // MM-DD
        datasets: [{
            label: '访问量',
            data: stats.value.trend.map(d => d.count),
            fill: true,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4
        }]
    };
});

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false }
    },
    scales: {
        y: {
            beginAtZero: true,
            grid: { color: '#f3f4f6' },
            ticks: { stepSize: 1 }
        },
        x: {
            grid: { display: false }
        }
    }
};

import { API } from '@/utils/constants';

onMounted(async () => {
    try {
        const response = await fetch(API.SPACE_STATS(props.spaceId));
        const result = await response.json();
        if (result.success) {
            stats.value = result.data;
        } else {
            error.value = result.message;
        }
    } catch (e) {
        error.value = '无法获取统计数据';
    } finally {
        loading.value = false;
    }
});
</script>
