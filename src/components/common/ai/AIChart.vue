<template>
  <AppCard indicator="blue" padding="p-4" class="w-full backdrop-blur-sm">
    <template v-if="title" #header>
      <h4 class="text-xs font-semibold tracking-wider text-(--text-secondary) uppercase">
        {{ title }}
      </h4>
    </template>
    <div class="relative h-64 w-full">
      <component :is="chartComponent" :data="enhancedData" :options="defaultOptions" />
    </div>
  </AppCard>
</template>

<script setup>
import { computed, onMounted, ref, onUnmounted } from 'vue';
import AppCard from '@/components/ui/AppCard.vue';
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
  Filler,
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
    validator: (value) => ['bar', 'line', 'pie', 'doughnut'].includes(value),
  },
  data: {
    type: Object,
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  options: {
    type: Object,
    default: () => ({}),
  },
});

// Map type string to component
const chartComponent = computed(() => {
  switch (props.type) {
    case 'bar':
      return Bar;
    case 'line':
      return Line;
    case 'pie':
      return Pie;
    case 'doughnut':
      return Doughnut;
    default:
      return Bar;
  }
});

// SOTA: Load colors from CSS variables
const chartColors = ref([]);
const grayColors = ref({});
const surfaceColor = ref('rgb(255, 255, 255)');
const fontSans = ref('Inter, system-ui, -apple-system, sans-serif');
let themeObserver = null;

const readThemeValue = (style, name, fallback) => style.getPropertyValue(name).trim() || fallback;

const parseColorToRgb = (color, fallback = '59, 130, 246') => {
  const normalized = String(color || '').trim();
  if (normalized.startsWith('#')) {
    let hex = normalized.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((part) => part + part)
        .join('');
    }

    if (hex.length === 6) {
      const int = Number.parseInt(hex, 16);
      return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
    }
  }

  const rgbMatch = normalized.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    return rgbMatch[1]
      .split(',')
      .slice(0, 3)
      .map((part) => part.trim())
      .join(', ');
  }

  return fallback;
};

const withAlpha = (color, alpha, fallback) => `rgba(${parseColorToRgb(color, fallback)}, ${alpha})`;

const loadThemeColors = () => {
  // Use a slight timeout to ensure CSS variables are applied by browser after class change
  setTimeout(() => {
    const style = getComputedStyle(document.documentElement);
    chartColors.value = [
      readThemeValue(style, '--color-chart-1', 'rgb(59, 130, 246)'),
      readThemeValue(style, '--color-chart-2', 'rgb(139, 92, 246)'),
      readThemeValue(style, '--color-chart-3', 'rgb(16, 185, 129)'),
      readThemeValue(style, '--color-chart-4', 'rgb(245, 158, 11)'),
      readThemeValue(style, '--color-chart-5', 'rgb(239, 68, 68)'),
    ];
    grayColors.value = {
      100: readThemeValue(style, '--color-gray-100', 'rgb(243, 244, 246)'),
      200: readThemeValue(style, '--color-gray-200', 'rgb(229, 231, 235)'),
      400: readThemeValue(style, '--color-gray-400', 'rgb(156, 163, 175)'),
      500: readThemeValue(style, '--color-gray-500', 'rgb(107, 114, 128)'),
      600: readThemeValue(style, '--color-gray-600', 'rgb(75, 85, 99)'),
      900: readThemeValue(style, '--color-gray-900', 'rgb(17, 24, 39)'),
    };
    surfaceColor.value = readThemeValue(style, '--bg-card', 'rgb(255, 255, 255)');
    fontSans.value = readThemeValue(
      style,
      '--font-family-sans',
      'Inter, system-ui, -apple-system, sans-serif'
    );
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
    attributeFilter: ['class'],
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
  const colors = chartColors.value.length ? chartColors.value : ['rgb(59, 130, 246)'];

  datasetClone.datasets = datasetClone.datasets.map((dataset, index) => {
    const color = colors[index % colors.length];

    if (props.type === 'line') {
      return {
        borderColor: color,
        backgroundColor: withAlpha(color, 0.12, '59, 130, 246'),
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointBackgroundColor: surfaceColor.value,
        pointBorderColor: color,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: surfaceColor.value,
        pointRadius: 4,
        ...dataset,
      };
    }

    if (props.type === 'bar') {
      return {
        backgroundColor: color,
        borderRadius: 4,
        hoverBackgroundColor: withAlpha(color, 0.86, '59, 130, 246'),
        ...dataset,
      };
    }

    if (props.type === 'pie' || props.type === 'doughnut') {
      return {
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'transparent',
        hoverOffset: 4,
        ...dataset,
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
          font: { size: 11, family: fontSans.value },
          color: gray[500] || 'var(--text-secondary)',
        },
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
      },
    },
    scales:
      props.type === 'pie' || props.type === 'doughnut'
        ? {}
        : {
            x: {
              grid: { display: false },
              ticks: { color: gray[400] || 'var(--text-muted)', font: { size: 10 } },
              border: { display: false },
            },
            y: {
              grid: { color: gray[100] || 'var(--color-chart-grid)', borderDash: [4, 4] },
              ticks: { color: gray[400] || 'var(--text-muted)', font: { size: 10 } },
              border: { display: false },
              beginAtZero: true,
            },
          },
    ...props.options,
  };
});
</script>
