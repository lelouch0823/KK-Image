import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, reactive } from 'vue';
import SalespersonManager from '../SalespersonManager.vue';

const mocks = vi.hoisted(() => ({
  loadSalespersons: vi.fn(),
  createSalesperson: vi.fn(),
  updateSalesperson: vi.fn(),
  deleteSalesperson: vi.fn(),
  resetToken: vi.fn(),
  copyAccessLink: vi.fn(),
}));

vi.mock('@/composables/useSalespersons', () => ({
  useSalespersons: () => ({
    salespersons: ref([]),
    loading: ref(false),
    error: ref(''),
    errorCode: ref(null),
    pagination: reactive({ page: 3, totalPages: 5 }),
    loadSalespersons: mocks.loadSalespersons,
    createSalesperson: mocks.createSalesperson,
    updateSalesperson: mocks.updateSalesperson,
    deleteSalesperson: mocks.deleteSalesperson,
    resetToken: mocks.resetToken,
    copyAccessLink: mocks.copyAccessLink,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('SalespersonManager refresh params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSalesperson.mockResolvedValue(true);
    mocks.updateSalesperson.mockResolvedValue(true);
    mocks.deleteSalesperson.mockResolvedValue(true);
  });

  function createWrapper() {
    return mount(SalespersonManager, {
      global: {
        stubs: {
          PermissionDeniedState: { template: '<div />' },
          SearchInput: { template: '<div />' },
          AppIcon: { template: '<div />' },
          Pagination: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          SalespersonTable: { template: '<div />' },
          SalespersonCards: { template: '<div />' },
          SalespersonForm: { template: '<div />' },
          SalespersonDetailModal: { template: '<div />' },
        },
      },
    });
  }

  it('keeps current search and bypasses cache after create submit', async () => {
    const wrapper = createWrapper();
    wrapper.vm.searchQuery = 'leo';

    await wrapper.vm.handleSubmit({ name: 'Alice' });

    expect(mocks.loadSalespersons).toHaveBeenLastCalledWith(
      { page: 3, search: 'leo' },
      true
    );
  });
});
