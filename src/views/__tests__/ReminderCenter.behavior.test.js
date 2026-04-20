import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ReminderCenter from '../ReminderCenter.vue';

const mocks = vi.hoisted(() => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  permissionDenied: false,
  permissionDeniedReason: '',
  fetchNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  setAdminMode: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('@/composables/useNotifications', () => ({
  useNotifications: () => mocks,
}));

describe('ReminderCenter view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notifications = [
      { id: 'n-1', title: '跟进客户', content: '订单 SO-1 需要回访', is_read: 0, created_at: 1710000000000 },
      { id: 'n-2', title: '确认到货', content: '订单 SO-2 待确认', is_read: 1, created_at: 1710001000000 },
    ];
    mocks.unreadCount = 1;
    mocks.loading = false;
    mocks.permissionDenied = false;
    mocks.permissionDeniedReason = '';
    mocks.fetchNotifications.mockResolvedValue(true);
  });

  it('loads admin notifications as reminder rows and supports marking one item read', async () => {
    const wrapper = mount(ReminderCenter, {
      global: {
        stubs: {
          ManagementListShell: {
            props: ['title', 'description'],
            template: '<section><h1>{{ title }}</h1><p>{{ description }}</p><slot /></section>',
          },
          AppButton: {
            props: ['text', 'disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}<slot /></button>',
          },
          StatusBadge: {
            props: ['variant'],
            template: '<span :data-variant="variant"><slot /></span>',
          },
          EmptyState: {
            props: ['title'],
            template: '<div data-testid="empty-state">{{ title }}</div>',
          },
          PermissionDeniedState: {
            props: ['title', 'description'],
            template: '<div data-testid="permission-state">{{ title }}|{{ description }}</div>',
          },
          AppIcon: true,
        },
      },
    });

    await flushPromises();

    expect(mocks.setAdminMode).toHaveBeenCalledTimes(1);
    expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('跟进客户');
    expect(wrapper.text()).toContain('确认到货');

    await wrapper.get('[data-testid="mark-read-n-1"]').trigger('click');
    expect(mocks.markAsRead).toHaveBeenCalledWith('n-1');
  });
});
