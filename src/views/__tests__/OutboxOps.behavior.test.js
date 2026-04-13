import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ref } from 'vue';
import Sidebar from '@/components/layout/Sidebar.vue';

const mocks = vi.hoisted(() => ({
  permissions: ['audit:read'],
  loadPermissions: vi.fn(async () => []),
  queueLoadEvents: vi.fn(async () => true),
  healthLoadEvents: vi.fn(async () => true),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, paramsOrFallback = {}) => {
      const messages = {
        'outboxOps.workspace.results': '共 {count} 条',
      };
      const hasFallback = typeof paramsOrFallback === 'string';
      const fallback = hasFallback ? paramsOrFallback : undefined;
      const params = !hasFallback && paramsOrFallback && typeof paramsOrFallback === 'object'
        ? paramsOrFallback
        : {};
      const value = messages[key] || fallback || key;

      if (typeof value === 'string' && Object.keys(params).length > 0) {
        return value.replace(/{(\w+)}/g, (_, token) => `${params[token] ?? `{${token}}`}`);
      }

      return value;
    },
  }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    logout: vi.fn(async () => {}),
    currentUser: ref({ id: 'admin-1', name: 'Admin', role: 'admin' }),
  }),
}));

vi.mock('@/composables/useAccessControl', () => ({
  useAccessControl: () => ({
    hasPermission: (permission) => mocks.permissions.includes(permission),
    loadPermissions: mocks.loadPermissions,
    permissionsLoaded: ref(true),
    clearPermissions: vi.fn(),
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('@/components/ui/Select.vue', () => ({
  default: {
    template: '<div />',
    props: ['modelValue', 'options', 'placeholder'],
  },
}));

vi.mock('@/composables/useOutboxOps', () => ({
  useOutboxOps: (() => {
    let callIndex = 0;

    return () => {
      callIndex += 1;
      const isQueueInstance = callIndex % 2 === 0;

      return {
        events: ref([{ id: 'evt-1', event_type: 'purchase_receipt_recorded' }]),
        loading: ref(false),
        error: ref(''),
        errorCode: ref(null),
        eventDetail: ref({ id: 'evt-1' }),
        detailLoading: ref(false),
        replayLoading: ref(false),
        lastReplayResult: ref(null),
        loadEvents: isQueueInstance ? mocks.queueLoadEvents : mocks.healthLoadEvents,
        loadEventDetail: vi.fn(async () => ({ id: 'evt-1' })),
        dryRunReplay: vi.fn(async () => ({ runId: 'dry-1' })),
        executeReplay: vi.fn(async () => ({ runId: 'exec-1' })),
        clearReplayResult: vi.fn(),
      };
    };
  })(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/admin/dashboard' }),
  useRouter: () => ({ push: vi.fn() }),
}));

describe('OutboxOps behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions = ['audit:read'];
  });

  it('registers an admin outbox ops route with audit permission', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/router/index.js'), 'utf8');

    expect(source).toContain("path: 'outbox-ops'");
    expect(source).toContain("titleKey: 'router.outbox_ops'");
    expect(source).toContain("permission: 'audit:read'");
  });

  it('shows the outbox ops menu item only for audit-capable users', async () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: {
          Transition: false,
          AppIcon: { template: '<i />' },
          ConfirmDialog: { template: '<div />' },
        },
      },
    });

    expect(wrapper.text()).toContain('router.outbox_ops');

    mocks.permissions = [];
    const noAuditWrapper = mount(Sidebar, {
      global: {
        stubs: {
          Transition: false,
          AppIcon: { template: '<i />' },
          ConfirmDialog: { template: '<div />' },
        },
      },
    });

    expect(noAuditWrapper.text()).not.toContain('router.outbox_ops');
  });

  it('renders the outbox ops page with event list and replay workspace regions', async () => {
    const module = await import('../OutboxOps.vue');
    const OutboxOps = module.default;

    const wrapper = mount(OutboxOps, {
      global: {
        stubs: {
          ManagementListShell: { template: '<div><slot name="filters" /><slot name="actions" /><slot name="summary" /><slot name="content" /></div>' },
          AppTable: { template: '<div data-testid="outbox-table" />' },
          AppButton: { template: '<button><slot /></button>' },
          AppInput: { template: '<input />' },
          AppSelect: { template: '<div />' },
          Select: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          OutboxEventTable: { template: '<div data-testid="outbox-event-table" />' },
          OutboxReplayPanel: { template: '<div data-testid="outbox-replay-panel" />' },
        },
      },
    });

    expect(wrapper.find('[data-testid="outbox-ops-banner"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="outbox-ops-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="outbox-workspace"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="outbox-event-table"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="outbox-replay-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('共 1 条');
  });

  it('does not issue a duplicate health list request when no filters are active', async () => {
    const module = await import('../OutboxOps.vue');
    const OutboxOps = module.default;

    mount(OutboxOps, {
      global: {
        stubs: {
          ManagementListShell: { template: '<div><slot name="filters" /><slot name="actions" /><slot name="summary" /><slot name="content" /></div>' },
          AppTable: { template: '<div data-testid="outbox-table" />' },
          AppButton: { template: '<button><slot /></button>' },
          AppInput: { template: '<input />' },
          AppSelect: { template: '<div />' },
          Select: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          OutboxEventTable: { template: '<div data-testid="outbox-event-table" />' },
          OutboxReplayPanel: { template: '<div data-testid="outbox-replay-panel" />' },
          MetricTile: { template: '<div />' },
          StatePanel: { template: '<div><slot /></div>' },
          SummaryStrip: { template: '<div><slot /></div>' },
          AppIcon: { template: '<i />' },
        },
      },
    });

    await flushPromises();

    expect(mocks.queueLoadEvents).toHaveBeenCalledWith({});
    expect(mocks.healthLoadEvents).not.toHaveBeenCalled();
  });

  it('shows global health as updating while filtered health refresh is still in flight', async () => {
    let resolveHealthRefresh;
    mocks.healthLoadEvents.mockImplementationOnce(() => new Promise((resolve) => {
      resolveHealthRefresh = resolve;
    }));

    const module = await import('../OutboxOps.vue');
    const OutboxOps = module.default;

    const wrapper = mount(OutboxOps, {
      global: {
        stubs: {
          ManagementListShell: { template: '<div><slot name="filters" /><slot name="actions" /><slot name="summary" /><slot name="content" /></div>' },
          AppTable: { template: '<div data-testid="outbox-table" />' },
          AppButton: {
            template: '<button @click="$emit(\'click\')"><slot />{{ text }}</button>',
            props: ['text'],
            emits: ['click'],
          },
          AppInput: {
            template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          AppSelect: {
            template: '<select @change="$emit(\'update:modelValue\', $event.target.value)"><option value=""></option></select>',
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
          },
          Select: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          OutboxEventTable: { template: '<div data-testid="outbox-event-table" />' },
          OutboxReplayPanel: { template: '<div data-testid="outbox-replay-panel" />' },
          MetricTile: { template: '<div />' },
          StatePanel: { template: '<div><slot /></div>' },
          SummaryStrip: { template: '<div><slot /></div>' },
          AppIcon: { template: '<i />' },
        },
      },
    });

    await flushPromises();
    await wrapper.find('input').setValue('purchase_receipt_recorded');
    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mocks.queueLoadEvents).toHaveBeenLastCalledWith({
      eventType: 'purchase_receipt_recorded',
      consumerName: '',
      status: '',
    });
    expect(mocks.healthLoadEvents).toHaveBeenCalledWith({});
    expect(wrapper.text()).toContain('全局健康概览更新中');

    resolveHealthRefresh(true);
    await flushPromises();
  });
});
