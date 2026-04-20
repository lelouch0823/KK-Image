import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import Stats from '../Stats.vue';

const mocks = vi.hoisted(() => {
  const Chart = vi.fn(function Chart(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.destroy = vi.fn();
    return this;
  });
  Chart.defaults = {
    color: '',
    borderColor: '',
  };

  return {
    authFetch: vi.fn(),
    addToast: vi.fn(),
    mutationObserve: vi.fn(),
    mutationDisconnect: vi.fn(),
    Chart,
  };
});

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => {
      const map = {
        'stats.statusOverview': 'Status Overview',
        'ai.subtitle': 'AI subtitle',
        'common.refresh': 'Refresh',
        'stats.loadFailed': 'Stats load failed',
        'stats.retry': 'Retry',
        'stats.totalFiles': 'Total Files',
        'stats.totalStorage': 'Total Storage',
        'stats.monthVisits': 'Month Visits',
        'dashboard.todayOrders': 'Today',
        'stats.trafficTrend': 'Traffic Trend',
        'stats.fileTypes': 'File Types',
        'stats.businessOverview': 'Business Overview',
        'stats.totalOrders': 'Total Orders',
        'stats.pendingOrders': 'Pending Orders',
        'stats.fulfilledOrders': 'Fulfilled Orders',
        'stats.activeSalespersons': 'Active Salespersons',
        'stats.topSpaces': 'Top Spaces',
        'stats.views': 'Views',
        'stats.noData': 'No data',
        'stats.normal': 'Normal',
        'stats.blocked': 'Blocked',
        'stats.whitelisted': 'Whitelisted',
        'stats.liked': 'Liked',
        'stats.largeFiles': 'Large Files',
        'stats.fileName': 'File Name',
        'stats.fileType': 'File Type',
        'stats.fileSize': 'File Size',
        'stats.loadError': 'Stats load error',
        'common.error.forbidden': 'Forbidden',
        'common.error.unauthorized': 'Unauthorized',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('chart.js/auto', () => ({
  default: mocks.Chart,
}));

describe('Stats view behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (token) => {
        const tokens = {
          '--color-primary': '#123456',
          '--color-success': '#135724',
          '--color-warning': '#b8860b',
          '--color-danger': '#a61b29',
          '--color-info': '#0b6ef6',
          '--border-color': '#d0d7de',
          '--text-main': '#111827',
          '--text-secondary': '#6b7280',
          '--bg-card': '#ffffff',
        };
        return tokens[token] || '';
      },
    }));

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
    }));

    vi.stubGlobal(
      'MutationObserver',
      class MutationObserver {
        constructor(callback) {
          this.callback = callback;
        }
        observe(...args) {
          mocks.mutationObserve(...args);
        }
        disconnect() {
          mocks.mutationDisconnect();
        }
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function createWrapper() {
    return mount(Stats, {
      global: {
        stubs: {
          DashboardShell: {
            props: ['title', 'description'],
            template: `
              <section>
                <h1>{{ title }}</h1>
                <p>{{ description }}</p>
                <slot name="actions" />
                <slot name="main" />
              </section>
            `,
          },
          AppButton: {
            props: ['text', 'loading', 'variant', 'disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}<slot name="icon-left" /></button>',
          },
          AppIcon: {
            props: ['name'],
            template: '<i :data-icon="name" />',
          },
          Skeleton: {
            template: '<div data-testid="skeleton">skeleton</div>',
          },
          PermissionDeniedState: {
            props: ['title', 'description'],
            emits: ['retry'],
            template: '<div data-testid="permission-state">{{ title }}|{{ description }}</div>',
          },
          AppStatCard: {
            props: ['label', 'value'],
            template: `
              <article data-testid="stat-card">
                <slot name="icon" />
                <span>{{ label }}</span>
                <strong>{{ value }}</strong>
                <slot name="footer" />
              </article>
            `,
          },
          StatusBadge: {
            props: ['variant'],
            template: '<span :data-variant="variant"><slot /></span>',
          },
          StatsChartWrapper: {
            props: ['title'],
            template: '<section><h2>{{ title }}</h2><slot /></section>',
          },
          SurfaceSection: {
            props: ['title', 'bodyClass'],
            template: '<section><h3>{{ title }}</h3><slot /></section>',
          },
          MetricTile: {
            props: ['label', 'value', 'icon', 'tone'],
            template: '<div data-testid="metric">{{ label }}:{{ value }}</div>',
          },
          AppTable: {
            props: ['columns', 'data'],
            template: `
              <div>
                <div v-for="(row, index) in data" :key="row.id || row.name" data-testid="large-file-row">
                  <slot name="cell-name" :row="row" :index="index" />
                  <slot name="cell-type" :row="row" />
                  <slot name="cell-index" :index="index" />
                  <slot name="cell-size" :row="row" />
                </div>
              </div>
            `,
          },
        },
      },
    });
  }

  it('loads stats successfully and renders charts and summary cards', async () => {
    mocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          storage: {
            totalFiles: 1200,
            totalSize: 2048,
            todayUploads: 3,
            largeFiles: [
              { id: 'file-1', name: 'hero.png', type: 'image/png', size: 1024 },
            ],
          },
          business: {
            totalOrders: 64,
            pendingOrders: 9,
            fulfilledOrders: 42,
            activeSalespersons: 5,
          },
          traffic: {
            monthTotal: 5600,
            daily: {
              '2026-04-01': 10,
              '2026-04-02': 20,
            },
            topSpaces: [
              { id: 'space-1-long-id', name: 'Main Space', views: 88 },
            ],
          },
          health: {
            status: {
              normal: 10,
              blocked: 1,
              whitelisted: 2,
              liked: 3,
            },
            fileTypes: [
              { type: 'image/png', count: 5 },
              { type: 'image/jpeg', count: 4 },
              { type: 'image/webp', count: 3 },
              { type: 'image/gif', count: 2 },
              { type: 'application/pdf', count: 1 },
              { type: 'image/svg+xml', count: 6 },
            ],
          },
        },
      }),
    });

    const wrapper = createWrapper();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenCalledWith('/api/manage/stats');
    expect(wrapper.text()).toContain('Status Overview');
    expect(wrapper.text()).toContain('Business Overview');
    expect(wrapper.text()).toContain('Total Orders');
    expect(wrapper.text()).toContain('64');
    expect(wrapper.text()).toContain('Total Files');
    expect(wrapper.text()).toContain('1200');
    expect(wrapper.text()).toContain('Main Space');
    expect(wrapper.text()).toContain('hero.png');
    expect(mocks.Chart).toHaveBeenCalledTimes(2);
    expect(mocks.Chart.mock.calls[1][1].data.labels).toContain('Other');
  });

  it('shows forbidden state when stats endpoint rejects with 403', async () => {
    mocks.authFetch.mockRejectedValue(Object.assign(new Error('需要 stats:read'), { status: 403, data: { error: '需要 stats:read' } }));

    const wrapper = createWrapper();
    await flushPromises();

    expect(wrapper.get('[data-testid="permission-state"]').text()).toContain('统计分析权限不足');
    expect(wrapper.text()).toContain('需要 stats:read');
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it('shows load error and toast when initial request fails', async () => {
    mocks.authFetch.mockRejectedValue(new Error('network down'));

    const wrapper = createWrapper();
    await flushPromises();

    expect(wrapper.text()).toContain('Stats load failed');
    expect(wrapper.text()).toContain('Stats load error');
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'Stats load error', type: 'error' });
  });

  it('keeps existing stats on refresh failure and shows a toast', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            storage: {
              totalFiles: 1200,
              totalSize: 2048,
              todayUploads: 3,
              largeFiles: [],
            },
            traffic: {
              monthTotal: 5600,
              daily: { '2026-04-01': 10 },
              topSpaces: [],
            },
            health: {
              status: { normal: 10, blocked: 1, whitelisted: 2, liked: 3 },
              fileTypes: [{ type: 'image/png', count: 5 }],
            },
          },
        }),
      })
      .mockRejectedValueOnce(new Error('refresh down'));

    const wrapper = createWrapper();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('1200');
    expect(wrapper.text()).not.toContain('Stats load failed');
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'Stats load error', type: 'error' });
  });
});
