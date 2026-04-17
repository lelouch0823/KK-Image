import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AIChart from '../AIChart.vue';

const mocks = vi.hoisted(() => ({
  chartRegister: vi.fn(),
}));

vi.mock('chart.js', () => ({
  Chart: {
    register: mocks.chartRegister,
  },
  Title: Symbol('Title'),
  Tooltip: Symbol('Tooltip'),
  Legend: Symbol('Legend'),
  BarElement: Symbol('BarElement'),
  LineElement: Symbol('LineElement'),
  PointElement: Symbol('PointElement'),
  ArcElement: Symbol('ArcElement'),
  CategoryScale: Symbol('CategoryScale'),
  LinearScale: Symbol('LinearScale'),
  Filler: Symbol('Filler'),
}));

vi.mock('vue-chartjs', () => ({
  Bar: { name: 'BarChart', props: ['data', 'options'], template: '<div data-testid="bar-chart">{{ JSON.stringify(data) }}</div>' },
  Line: { name: 'LineChart', props: ['data', 'options'], template: '<div data-testid="line-chart">{{ JSON.stringify(data) }}</div>' },
  Pie: { name: 'PieChart', props: ['data', 'options'], template: '<div data-testid="pie-chart">{{ JSON.stringify(data) }}</div>' },
  Doughnut: { name: 'DoughnutChart', props: ['data', 'options'], template: '<div data-testid="doughnut-chart">{{ JSON.stringify(data) }}</div>' },
}));

describe('AIChart behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (token) => {
        const tokens = {
          '--color-chart-1': '#112233',
          '--color-chart-2': 'rgb(10, 20, 30)',
          '--color-chart-3': '#445566',
          '--color-chart-4': '#778899',
          '--color-chart-5': '#abcdef',
          '--color-gray-100': '#f3f4f6',
          '--color-gray-200': '#e5e7eb',
          '--color-gray-400': '#9ca3af',
          '--color-gray-500': '#6b7280',
          '--color-gray-600': '#4b5563',
          '--color-gray-900': '#111827',
          '--bg-card': '#ffffff',
          '--font-family-sans': 'Test Sans',
        };
        return tokens[token] || '';
      },
    }));

    vi.stubGlobal(
      'MutationObserver',
      class MutationObserver {
        constructor(callback) {
          this.callback = callback;
        }

        observe() {}

        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function createWrapper(props) {
    return mount(AIChart, {
      props,
      global: {
        stubs: {
          AppCard: {
            props: ['indicator', 'padding'],
            template: '<section><slot name="header" /><slot /></section>',
          },
        },
      },
    });
  }

  it('registers chart.js plugins and renders a themed line chart', async () => {
    const wrapper = createWrapper({
      type: 'line',
      title: 'Trend',
      data: {
        labels: ['Mon', 'Tue'],
        datasets: [{ label: 'Traffic', data: [10, 20] }],
      },
    });

    await vi.advanceTimersByTimeAsync(20);

    expect(mocks.chartRegister).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Trend');
    expect(wrapper.find('[data-testid="line-chart"]').exists()).toBe(true);

    const lineChart = wrapper.findComponent({ name: 'LineChart' });
    const dataset = lineChart.props('data').datasets[0];
    const options = lineChart.props('options');

    expect(dataset.borderColor).toBe('#112233');
    expect(dataset.backgroundColor).toBe('rgba(17, 34, 51, 0.12)');
    expect(dataset.pointBackgroundColor).toBe('#ffffff');
    expect(options.plugins.legend.labels.font.family).toBe('Test Sans');
    expect(options.scales.x.ticks.color).toBe('#9ca3af');
  });

  it('builds themed bar and pie variants from the provided type', async () => {
    const barWrapper = createWrapper({
      type: 'bar',
      data: {
        labels: ['A'],
        datasets: [{ label: 'Bars', data: [5] }],
      },
    });
    const pieWrapper = createWrapper({
      type: 'pie',
      data: {
        labels: ['A', 'B'],
        datasets: [{ data: [1, 2] }],
      },
    });
    const doughnutWrapper = createWrapper({
      type: 'doughnut',
      data: {
        labels: ['A', 'B'],
        datasets: [{ data: [1, 2] }],
      },
    });

    await vi.advanceTimersByTimeAsync(20);

    const barDataset = barWrapper.findComponent({ name: 'BarChart' }).props('data').datasets[0];
    expect(barWrapper.find('[data-testid="bar-chart"]').exists()).toBe(true);
    expect(barDataset.backgroundColor).toBe('#112233');
    expect(barDataset.hoverBackgroundColor).toBe('rgba(17, 34, 51, 0.86)');

    const pieProps = pieWrapper.findComponent({ name: 'PieChart' }).props();
    expect(pieWrapper.find('[data-testid="pie-chart"]').exists()).toBe(true);
    expect(pieProps.data.datasets[0].backgroundColor).toEqual([
      '#112233',
      'rgb(10, 20, 30)',
      '#445566',
      '#778899',
      '#abcdef',
    ]);
    expect(pieProps.options.scales).toEqual({});

    expect(doughnutWrapper.find('[data-testid="doughnut-chart"]').exists()).toBe(true);
  });

  it('reacts to class mutations by reloading theme colors', async () => {
    let observerCallback;
    vi.stubGlobal(
      'MutationObserver',
      class MutationObserver {
        constructor(callback) {
          observerCallback = callback;
        }

        observe() {}

        disconnect() {}
      }
    );

    const wrapper = createWrapper({
      type: 'bar',
      data: {
        labels: ['A'],
        datasets: [{ label: 'Bars', data: [5] }],
      },
    });

    await vi.advanceTimersByTimeAsync(20);
    observerCallback([{ attributeName: 'class' }]);
    await vi.advanceTimersByTimeAsync(20);

    const barDataset = wrapper.findComponent({ name: 'BarChart' }).props('data').datasets[0];
    expect(barDataset.backgroundColor).toBe('#112233');
  });
});
