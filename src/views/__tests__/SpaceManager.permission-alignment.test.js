import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import SpaceManager from '../SpaceManager/index.vue';

const mockSpaces = ref([]);
const mockLoading = ref(false);
const mockError = ref('');
const mockErrorCode = ref(null);

const mocks = vi.hoisted(() => ({
  loadSpaces: vi.fn(),
  deleteSpace: vi.fn(),
  loadPermissions: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/composables/useSpaces', () => ({
  useSpaces: () => ({
    spaces: mockSpaces,
    loading: mockLoading,
    error: mockError,
    errorCode: mockErrorCode,
    loadSpaces: mocks.loadSpaces,
    deleteSpace: mocks.deleteSpace,
  }),
}));

vi.mock('@/composables/useAccessControl', () => ({
  useAccessControl: () => ({
    loadPermissions: mocks.loadPermissions,
    hasPermission: mocks.hasPermission,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

describe('SpaceManager permission alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpaces.value = [];
    mockLoading.value = false;
    mockError.value = '';
    mockErrorCode.value = null;
    mocks.loadSpaces.mockResolvedValue(undefined);
    mocks.deleteSpace.mockResolvedValue(true);
    mocks.loadPermissions.mockResolvedValue([]);
    mocks.hasPermission.mockImplementation((permission) => permission === 'spaces:manage');
  });

  function createWrapper() {
    return mount(SpaceManager, {
      global: {
        stubs: {
          ManagementListShell: { template: '<div><slot name="actions" /><slot name="content" /><slot /></div>' },
          Tooltip: { template: '<div><slot /></div>' },
          SpaceCreateModal: { template: '<div />' },
          SpaceProductEditor: { template: '<div data-testid="product-editor" />' },
          SpaceDetailModal: { template: '<div data-testid="space-detail" />' },
          ConfirmDialog: { template: '<div />' },
          Skeleton: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          EmptyState: { template: '<div><slot name="action" /></div>' },
          PermissionDeniedState: { template: '<div />' },
        },
      },
    });
  }

  it('opens product space editor when space manage is allowed but product manage is not', async () => {
    const wrapper = createWrapper();
    await flushPromises();

    wrapper.vm.selectedSpace = { id: 'space-1', template: 'product' };
    await flushPromises();

    expect(wrapper.find('[data-testid="product-editor"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="space-detail"]').exists()).toBe(false);
  });
});
