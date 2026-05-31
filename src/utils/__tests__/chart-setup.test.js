import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRegister = vi.fn();

vi.mock('chart.js', () => ({
  Chart: { register: mockRegister },
  LineController: 'LineController',
  DoughnutController: 'DoughnutController',
  LineElement: 'LineElement',
  PointElement: 'PointElement',
  ArcElement: 'ArcElement',
  LinearScale: 'LinearScale',
  CategoryScale: 'CategoryScale',
  Filler: 'Filler',
  Tooltip: 'Tooltip',
  Legend: 'Legend',
}));

describe('chart-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('应导出 Chart 对象', async () => {
    const { Chart } = await import('../chart-setup');
    expect(Chart).toBeDefined();
    expect(typeof Chart).toBe('object');
    expect(Chart.register).toBe(mockRegister);
  });

  it('应在模块加载时调用 Chart.register 注册组件', async () => {
    await import('../chart-setup');
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('应注册所有必需的 Chart.js 组件', async () => {
    await import('../chart-setup');
    const registeredComponents = mockRegister.mock.calls[0];
    // 应包含 10 个组件
    expect(registeredComponents).toHaveLength(10);
    expect(registeredComponents).toContain('LineController');
    expect(registeredComponents).toContain('DoughnutController');
    expect(registeredComponents).toContain('LineElement');
    expect(registeredComponents).toContain('PointElement');
    expect(registeredComponents).toContain('ArcElement');
    expect(registeredComponents).toContain('LinearScale');
    expect(registeredComponents).toContain('CategoryScale');
    expect(registeredComponents).toContain('Filler');
    expect(registeredComponents).toContain('Tooltip');
    expect(registeredComponents).toContain('Legend');
  });
});
