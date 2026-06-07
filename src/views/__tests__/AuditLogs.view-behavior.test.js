import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AuditLogs from '../AuditLogs.vue';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, arg) => {
      if (typeof arg === 'string') return arg;
      if (key === 'auditLogs.title') return 'Audit Logs';
      if (key === 'auditLogs.empty') return 'No audit logs';
      if (key === 'common.refresh') return 'Refresh';
      if (key === 'common.prev') return 'Prev';
      if (key === 'common.next') return 'Next';
      if (key === 'auditLogs.allActions') return 'All Actions';
      if (key === 'auditLogs.allResults') return 'All Results';
      if (key === 'auditLogs.allSeverities') return 'All Severities';
      if (key === 'auditLogs.user') return 'User';
      if (key === 'auditLogs.time') return 'Time';
      if (key === 'auditLogs.action') return 'Action';
      if (key === 'auditLogs.result') return 'Result';
      if (key === 'auditLogs.severity') return 'Severity';
      if (key === 'auditLogs.target') return 'Target';
      if (key === 'auditLogs.summary') return 'Summary';
      if (key === 'auditLogs.details') return 'Details';
      if (key === 'auditLogs.pagination') return `Page ${arg.page} / ${arg.total}`;
      if (key === 'auditLogs.permissionDenied') return '审计日志权限不足';
      if (key === 'auditLogs.permissionDeniedDesc') return '当前账号缺少审计日志读取权限。';
      if (key === 'auditLogs.loadFailed') return '审计日志加载失败';
      if (key === 'auditLogs.loadFailedDesc') return '审计日志加载失败，请稍后重试。';
      if (key === 'auditLogs.sessionExpired') return '登录状态失效，请重新登录后重试。';
      if (key === 'common.loadFailed') return 'Load failed';
      return key;
    },
  }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

describe('AuditLogs view behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createWrapper() {
    return mount(AuditLogs, {
      global: {
        stubs: {
          ManagementListShell: {
            props: ['title', 'description'],
            template: `
              <section>
                <h1>{{ title }}</h1>
                <slot name="filters" />
                <slot name="actions" />
                <slot name="content" />
              </section>
            `,
          },
          AppButton: {
            props: ['text', 'disabled', 'variant'],
            emits: ['click'],
            template:
              '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}<slot /></button>',
          },
          AppInput: {
            props: ['modelValue', 'placeholder', 'size'],
            emits: ['update:modelValue'],
            template: `
              <input
                data-testid="actor-input"
                :placeholder="placeholder"
                :value="modelValue"
                @input="$emit('update:modelValue', $event.target.value)"
              />
            `,
          },
          AppSelect: {
            props: ['modelValue', 'options', 'placeholder', 'size'],
            emits: ['update:modelValue'],
            template: `
              <select
                data-testid="select-input"
                :value="modelValue"
                @change="$emit('update:modelValue', $event.target.value)"
              >
                <option value="">{{ placeholder }}</option>
                <option v-for="option in options" :key="option.value || option.label" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            `,
          },
          StatusBadge: {
            props: ['variant'],
            template: '<span :data-variant="variant"><slot /></span>',
          },
          PermissionDeniedState: {
            props: ['title', 'description', 'reason'],
            emits: ['retry'],
            template: `
              <div data-testid="permission-state">
                <strong>{{ title }}</strong>
                <p>{{ description }}</p>
                <p v-if="reason">{{ reason }}</p>
                <button data-testid="retry" @click="$emit('retry')">Retry</button>
              </div>
            `,
          },
          AppTable: {
            props: ['columns', 'data', 'loading', 'emptyText'],
            template: `
              <div>
                <div v-if="loading" data-testid="loading">loading</div>
                <div v-else-if="!data.length" data-testid="empty">{{ emptyText }}</div>
                <div v-for="row in data" :key="row.id" data-testid="audit-row">
                  <slot name="cell-created_at" :value="row.created_at" />
                  <slot name="cell-actor_display" :value="row.actor_display" :row="row" />
                  <slot name="cell-action" :value="row.action" />
                  <slot name="cell-result" :value="row.result" />
                  <slot name="cell-severity" :value="row.severity" />
                  <slot name="cell-target" :row="row" />
                  <slot name="cell-summary_display" :value="row.summary_display" />
                  <slot name="cell-details" :row="row" />
                </div>
                <slot name="footer" />
              </div>
            `,
          },
        },
      },
    });
  }

  it('loads logs and filter actions on mount', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [
            {
              id: 'audit-1',
              created_at: '2026-04-18T10:00:00.000Z',
              actor_name: 'Admin',
              actor_type: 'admin',
              action: 'order.create',
              result: 'success',
              severity: 'normal',
              target_type: 'order',
              target_id: 'SO-1',
              metadata_json: '{"note":"created"}',
            },
          ],
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: ['order.create', 'order.update'],
        }),
      });

    const wrapper = createWrapper();
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenNthCalledWith(1, '/api/manage/audit-logs?page=1&pageSize=50');
    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, '/api/manage/audit-logs/actions');
    expect(wrapper.text()).toContain('Audit Logs');
    expect(wrapper.text()).toContain('Admin');
    expect(wrapper.text()).toContain('order.create');
    expect(wrapper.find('[data-variant="success"]').exists()).toBe(true);
  });

  it('shows forbidden state when the list endpoint rejects with 403', async () => {
    mocks.authFetch
      .mockRejectedValueOnce(
        Object.assign(new Error('权限不足'), { status: 403, data: { error: '需要 audit:read' } })
      )
      .mockRejectedValueOnce(Object.assign(new Error('权限不足'), { status: 403 }));

    const wrapper = createWrapper();
    await flushPromises();

    expect(wrapper.get('[data-testid="permission-state"]').text()).toContain('审计日志权限不足');
    expect(wrapper.text()).toContain('需要 audit:read');
  });

  it('shows unauthorized state when the list endpoint rejects with 401', async () => {
    mocks.authFetch
      .mockRejectedValueOnce(
        Object.assign(new Error('登录失效'), { status: 401, data: { error: '登录失效' } })
      )
      .mockRejectedValueOnce(Object.assign(new Error('权限不足'), { status: 403 }));

    const wrapper = createWrapper();
    await flushPromises();

    expect(wrapper.get('[data-testid="permission-state"]').text()).toContain('审计日志加载失败');
    expect(wrapper.text()).toContain('登录状态失效，请重新登录后重试。');
    expect(wrapper.text()).toContain('登录失效');
  });

  it('refetches with filter and pagination parameters', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [
            {
              id: 'audit-1',
              created_at: '2026-04-18T10:00:00.000Z',
              actor_name: 'Admin',
              actor_type: 'admin',
              action: 'order.create',
              result: 'success',
              severity: 'normal',
              target_type: 'order',
              target_id: 'SO-1',
              metadata_json: '{"note":"created"}',
            },
          ],
          pagination: { page: 1, pageSize: 50, total: 2, totalPages: 2 },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: ['order.create', 'order.update'] }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 2, pageSize: 50, total: 2, totalPages: 2 },
        }),
      });

    const wrapper = createWrapper();
    await flushPromises();

    const selects = wrapper.findAll('[data-testid="select-input"]');
    await selects[0].setValue('order.update');
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenNthCalledWith(
      3,
      '/api/manage/audit-logs?page=1&pageSize=50&action=order.update'
    );

    await wrapper.get('[data-testid="actor-input"]').setValue('u-admin');
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenNthCalledWith(
      4,
      '/api/manage/audit-logs?page=1&pageSize=50&action=order.update&actorId=u-admin'
    );
  });
});
