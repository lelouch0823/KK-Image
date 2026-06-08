import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import Header from '@/components/layout/Header.vue';

const mocks = vi.hoisted(() => ({
  setAdminMode: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  loadPermissions: vi.fn(),
  hasPermission: vi.fn(),
  searchQuery: null,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: { title: 'Dashboard' } }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/composables/useSearch', () => {
  const searchQuery = ref('');
  mocks.searchQuery = searchQuery;
  return {
    useSearch: () => ({ searchQuery }),
  };
});

vi.mock('@/composables/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: ref(0),
    startPolling: mocks.startPolling,
    stopPolling: mocks.stopPolling,
    setAdminMode: mocks.setAdminMode,
    permissionDenied: ref(false),
    permissionDeniedReason: ref(''),
  }),
}));

vi.mock('@/composables/useAI', () => ({
  useAI: () => ({ isOpen: ref(false), toggle: vi.fn() }),
}));

vi.mock('@/composables/useAccessControl', () => ({
  useAccessControl: () => ({
    hasPermission: mocks.hasPermission,
    loadPermissions: mocks.loadPermissions,
  }),
}));

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({ isDark: ref(false), toggleTheme: vi.fn() }),
}));

vi.mock('@vueuse/core', () => ({
  onClickOutside: vi.fn(),
}));

vi.mock('@/composables/useCommandPalette', () => ({
  useCommandPalette: () => ({
    openCommandPalette: vi.fn(),
    isOpen: ref(false),
  }),
}));

vi.mock('@/composables/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    register: vi.fn(),
    unregister: vi.fn(),
    attachListener: vi.fn(),
    detachListener: vi.fn(),
  }),
}));

vi.mock('@/composables/useRecentViews', () => ({
  useRecentViews: () => ({
    recentViews: ref([]),
    addView: vi.fn(),
    removeView: vi.fn(),
    clearRecentViews: vi.fn(),
  }),
}));

vi.mock('@/composables/useNotificationStream', () => ({
  useNotificationStream: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
  }),
}));

const SearchInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue', 'clear'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  methods: {
    focus() {},
  },
};

describe('Header notification mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPermissions.mockResolvedValue();
    mocks.hasPermission.mockReturnValue(false);
    mocks.searchQuery.value = '';
  });

  it('switches notifications back to admin mode on mount', async () => {
    mount(Header, {
      global: {
        stubs: {
          NotificationList: true,
          AppIcon: true,
          SearchInput: SearchInputStub,
        },
      },
    });

    await flushPromises();

    expect(mocks.setAdminMode).toHaveBeenCalledTimes(1);
    expect(mocks.startPolling).toHaveBeenCalledTimes(1);
  });

  it('keeps header shell actions on shared buttons', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Header.vue'), 'utf8');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });

  it('keeps the shared search query when mobile search is dismissed', async () => {
    mocks.searchQuery.value = 'pending order';
    const wrapper = mount(Header, {
      global: {
        stubs: {
          NotificationList: true,
          AppIcon: true,
          SearchInput: SearchInputStub,
        },
      },
    });

    await flushPromises();
    await wrapper.find('button[aria-label="header.searchPlaceholder"]').trigger('click');
    await flushPromises();

    const cancelButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('common.cancel'));

    expect(cancelButton).toBeTruthy();
    await cancelButton.trigger('click');

    expect(mocks.searchQuery.value).toBe('pending order');
  });
});
