/**
 * Chart.js tree-shakeable 导入配置
 * 只注册 Dashboard.vue 和 Stats.vue 实际使用的组件，避免全量导入 (~200KB)
 */
import {
  Chart,
  type ChartComponentLike,
  LineController,
  DoughnutController,
  BarController,
  LineElement,
  PointElement,
  ArcElement,
  BarElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

const components: ChartComponentLike[] = [
  LineController,
  DoughnutController,
  BarController,
  LineElement,
  PointElement,
  ArcElement,
  BarElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
];

Chart.register(...components);

export { Chart };
