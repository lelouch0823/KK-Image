import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SalesNotificationList from '@/components/order/SalesNotificationList.vue';

const mocks = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/composables/useNotifications', () => ({
  useNotifications: () => ({
    notifications: ref([]),
    unreadCount: ref(0),
    loading: ref(false),
    initialized: ref(false),
    markAsRead: mocks.markAsRead,
    markAllAsRead: mocks.markAllAsRead,
    fetchNotifications: mocks.fetchNotifications,
  }),
}));

describe('SalesNotificationList error state', () => {
  it('notification list handles fetch failures with guidance', async () => {
    const wrapper = mount(SalesNotificationList, {
      props: {
        close: vi.fn(),
      },
      global: {
        stubs: {
          EmptyState: true,
          AppIcon: true,
        },
      },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="notification-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="notification-retry"]').exists()).toBe(true);
  });
});
