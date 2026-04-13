import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ref } from 'vue';
import Sidebar from '@/components/layout/Sidebar.vue';

const mocks = vi.hoisted(() => ({
  permissions: ['audit:read'],
  loadPermissions: vi.fn(async () => []),
  loadEvents: vi.fn(async () => true),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
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
  useOutboxOps: () => ({
    events: ref([{ id: 'evt-1', event_type: 'purchase_receipt_recorded' }]),
    loading: ref(false),
    error: ref(''),
    errorCode: ref(null),
    eventDetail: ref({ id: 'evt-1' }),
    detailLoading: ref(false),
    replayLoading: ref(false),
    lastReplayResult: ref(null),
    loadEvents: mocks.loadEvents,
    loadEventDetail: vi.fn(async () => ({ id: 'evt-1' })),
    dryRunReplay: vi.fn(async () => ({ runId: 'dry-1' })),
    executeReplay: vi.fn(async () => ({ runId: 'exec-1' })),
    clearReplayResult: vi.fn(),
  }),
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
  });
});
