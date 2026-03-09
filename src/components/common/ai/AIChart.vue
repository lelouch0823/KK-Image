<template>
  <div class="bg-card/50 border-border w-full rounded-xl border p-4 shadow-sm backdrop-blur-sm">
    <div v-if="title" class="mb-4 flex items-center gap-2">
      <div class="bg-primary/20 size-1.5 rounded-full"></div>
      <h4 class="text-xs font-semibold tracking-wider text-(--text-secondary) uppercase">{{ title }}</h4>
    </div>
    <div class="relative h-64 w-full">
      <component 
        :is="chartComponent" 
        :data="enhancedData" 
        :options="defaultOptions" 
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, onUnmounted } from 'vue';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'vue-chartjs';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const props = defineProps({
  type: {
    type: String,
    required: true,
    validator: (value) => ['bar', 'line', 'pie', 'doughnut'].includes(value)
  },
  data: {
    type: Object,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  options: {
    type: Object,
    default: () => ({})
  }
});

// Map type string to component
const chartComponent = computed(() => {
  switch (props.type) {
    case 'bar': return Bar;
    case 'line': return Line;
    case 'pie': return Pie;
    case 'doughnut': return Doughnut;
    default: return Bar;
  }
});

// SOTA: Load colors from CSS variables
const chartColors = ref([]);
const grayColors = ref({});
let themeObserver = null;

const loadThemeColors = () => {
  // Use a slight timeout to ensure CSS variables are applied by browser after class change
  setTimeout(() => {
    const style = getComputedStyle(document.documentElement);
    chartColors.value = [
      style.getPropertyValue('--color-chart-1').trim() || '#3B82F6',
      style.getPropertyValue('--color-chart-2').trim() || '#8B5CF6',
      style.getPropertyValue('--color-chart-3').trim() || '#10B981',
      style.getPropertyValue('--color-chart-4').trim() || '#F59E0B',
      style.getPropertyValue('--color-chart-5').trim() || '#EF4444',
    ];
    grayColors.value = {
      100: style.getPropertyValue('--color-gray-100').trim() || '#F3F4F6',
      200: style.getPropertyValue('--color-gray-200').trim() || '#E5E7EB',
      400: style.getPropertyValue('--color-gray-400').trim() || '#9CA3AF',
      500: style.getPropertyValue('--color-gray-500').trim() || '#6B7280',
      600: style.getPropertyValue('--color-gray-600').trim() || '#4B5563',
      900: style.getPropertyValue('--color-gray-900').trim() || '#111827',
    };
  }, 10);
};

onMounted(() => {
  loadThemeColors();
  
  // React to dark mode toggle
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        loadThemeColors();
      }
    });
  });
  
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
});

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }
});

// Enhance data with application theme colors
const enhancedData = computed(() => {
  const datasetClone = JSON.parse(JSON.stringify(props.data));
  const colors = chartColors.value.length ? chartColors.value : ['#3B82F6'];
  
  datasetClone.datasets = datasetClone.datasets.map((dataset, index) => {
    const color = colors[index % colors.length];
    
    if (props.type === 'line') {
      return {
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: color,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#ffffff',
        pointRadius: 4,
        ...dataset
      };
    }
    
    if (props.type === 'bar') {
      return {
        backgroundColor: color,
        borderRadius: 4,
        hoverBackgroundColor: `${color}dd`,
        ...dataset
      };
    }

    if (props.type === 'pie' || props.type === 'doughnut') {
       return {
         backgroundColor: colors,
         borderWidth: 2,
         borderColor: 'transparent',
         hoverOffset: 4,
         ...dataset
       };
    }

    return dataset;
  });

  return datasetClone;
});

// SOTA Default Options using CSS variables
const defaultOptions = computed(() => {
  const gray = grayColors.value;
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 20,
          font: { size: 11, family: "'Outfit', 'Inter', sans-serif" },
          color: gray[500] || 'var(--text-secondary)'
        }
      },
      tooltip: {
        backgroundColor: 'var(--bg-card)',
        titleColor: gray[900] || 'var(--text-main)',
        bodyColor: gray[600] || 'var(--text-secondary)',
        borderColor: gray[200] || 'var(--border-color)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { weight: '600' },
        cornerRadius: 8,
        displayColors: true,
      }
    },
    scales: (props.type === 'pie' || props.type === 'doughnut') ? {} : {
      x: {
        grid: { display: false },
        ticks: { color: gray[400] || 'var(--text-muted)', font: { size: 10 } },
        border: { display: false }
      },
      y: {
        grid: { color: gray[100] || 'var(--color-chart-grid)', borderDash: [4, 4] },
        ticks: { color: gray[400] || 'var(--text-muted)', font: { size: 10 } },
        border: { display: false },
        beginAtZero: true
      }
    },
    ...props.options
  };
});
</script>
