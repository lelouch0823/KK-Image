/**
 * Chart.js tree-shakeable 导入配置
 * 只注册 Dashboard.vue 和 Stats.vue 实际使用的组件，避免全量导入 (~200KB)
 */
import {
  Chart,
  LineController,
  DoughnutController,
  LineElement,
  PointElement,
  ArcElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  LineController,
  DoughnutController,
  LineElement,
  PointElement,
  ArcElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
);

export { Chart };
